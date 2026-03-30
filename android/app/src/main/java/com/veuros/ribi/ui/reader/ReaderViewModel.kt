package com.veuros.ribi.ui.reader

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.veuros.ribi.data.model.*
import com.veuros.ribi.data.repository.BookRepository
import com.veuros.ribi.data.repository.SettingsRepository
import com.veuros.ribi.service.TtsManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.File
import javax.inject.Inject

data class ReaderUiState(
    val book: BookMetadata? = null,
    val settings: ReaderSettings = ReaderSettings(),
    val currentPage: Int = 1,
    val totalPages: Int = 0,
    val isLoading: Boolean = true,
    val loadError: String? = null,
    val isHudVisible: Boolean = true,
    val showToc: Boolean = false,
    val toc: List<TocItem> = emptyList(),
    val newAchievement: Pair<String, String>? = null,
    val isBookmarked: Boolean = false,
    val zoomScale: Float = 1.0f,
    // TTS
    val isTtsSpeaking: Boolean = false,
    val ttsPageText: String = "",
    val ttsError: String? = null
)

@HiltViewModel
class ReaderViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val bookRepo: BookRepository,
    private val settingsRepo: SettingsRepository,
    private val ttsManager: TtsManager
) : ViewModel() {

    companion object {
        private const val TAG = "ReaderViewModel"
        private const val LRU_CACHE_SIZE = 10
    }

    private val _uiState = MutableStateFlow(ReaderUiState())
    val uiState: StateFlow<ReaderUiState> = _uiState.asStateFlow()

    private val _renderedPage = MutableStateFlow<Bitmap?>(null)
    val renderedPage: StateFlow<Bitmap?> = _renderedPage.asStateFlow()

    private var pdfRenderer: PdfRenderer? = null
    private var pfd: ParcelFileDescriptor? = null
    private val pageCache = LinkedHashMap<Int, Bitmap>(LRU_CACHE_SIZE, 0.75f, true)
    private var renderJob: Job? = null
    private var hudJob: Job? = null
    private var settingsJob: Job? = null
    private var hudVisible = true
    private var currentFilePath: String? = null

    fun loadBook(bookId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadError = null) }

            val book = bookRepo.books.first().find { it.id == bookId }
            if (book == null) {
                _uiState.update { it.copy(isLoading = false, loadError = "Book not found") }
                return@launch
            }

            val settings = settingsRepo.settings.first()
            val effectiveTheme = resolveTheme(settings)

            try {
                val file = File(book.filePath)
                if (!file.exists()) {
                    _uiState.update { it.copy(isLoading = false, loadError = "PDF file not found on device") }
                    return@launch
                }
                currentFilePath = book.filePath
                pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                pdfRenderer = PdfRenderer(pfd!!)
                val totalPages = pdfRenderer!!.pageCount

                _uiState.update {
                    it.copy(
                        book = book,
                        settings = settings.copy(theme = effectiveTheme),
                        currentPage = book.currentPage.coerceAtLeast(1),
                        totalPages = totalPages,
                        isLoading = false,
                        isBookmarked = book.bookmarks.any { bm -> bm.pageNumber == book.currentPage }
                    )
                }

                renderPage(book.currentPage.coerceAtLeast(1))
                scheduleHudHide()

                // Initialize TTS
                ttsManager.initialize(context) {
                    Log.d(TAG, "TTS ready for book")
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to open PDF", e)
                _uiState.update { it.copy(isLoading = false, loadError = "Cannot open PDF: ${e.message}") }
                return@launch
            }

            // Watch settings changes
            settingsJob = launch {
                settingsRepo.settings.collect { s ->
                    val theme = resolveTheme(s)
                    _uiState.update { it.copy(settings = s.copy(theme = theme)) }
                }
            }
        }
    }

    private fun resolveTheme(settings: ReaderSettings): AppTheme {
        if (!settings.autoNightMode) return settings.theme
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return if (hour >= 21 || hour < 6) AppTheme.MIDNIGHT else settings.theme
    }

    fun goToPage(page: Int) {
        val total = _uiState.value.totalPages
        val clamped = page.coerceIn(1, if (total > 0) total else 1)
        if (clamped == _uiState.value.currentPage && _renderedPage.value != null) return

        _uiState.update { s ->
            s.copy(
                currentPage = clamped,
                isBookmarked = s.book?.bookmarks?.any { it.pageNumber == clamped } == true,
                isTtsSpeaking = false
            )
        }

        ttsManager.stop()
        renderPage(clamped)

        viewModelScope.launch {
            val bookId = _uiState.value.book?.id ?: return@launch
            bookRepo.updateProgress(bookId, clamped)

            // Auto-speak if TTS enabled
            if (_uiState.value.settings.ttsEnabled) {
                delay(400) // let render start first
                speakCurrentPage()
            }
        }
    }

    fun nextPage() {
        val s = _uiState.value
        if (s.currentPage < s.totalPages) goToPage(s.currentPage + 1)
    }

    fun previousPage() {
        val s = _uiState.value
        if (s.currentPage > 1) goToPage(s.currentPage - 1)
    }

    fun zoomIn() {
        val scale = (_uiState.value.zoomScale + 0.25f).coerceAtMost(4f)
        _uiState.update { it.copy(zoomScale = scale) }
        reRenderCurrentPage()
    }

    fun zoomOut() {
        val scale = (_uiState.value.zoomScale - 0.25f).coerceAtLeast(0.5f)
        _uiState.update { it.copy(zoomScale = scale) }
        reRenderCurrentPage()
    }

    fun resetZoom() {
        _uiState.update { it.copy(zoomScale = 1f) }
        reRenderCurrentPage()
    }

    private fun reRenderCurrentPage() {
        val page = _uiState.value.currentPage
        synchronized(pageCache) { pageCache.remove(page) }
        renderPage(page)
    }

    fun showHud() {
        hudVisible = true
        _uiState.update { it.copy(isHudVisible = true) }
        scheduleHudHide()
    }

    fun toggleHud() {
        hudVisible = !hudVisible
        _uiState.update { it.copy(isHudVisible = hudVisible) }
        if (hudVisible) scheduleHudHide()
    }

    private fun scheduleHudHide() {
        hudJob?.cancel()
        hudJob = viewModelScope.launch {
            delay(3500)
            hudVisible = false
            _uiState.update { it.copy(isHudVisible = false) }
        }
    }

    fun toggleToc() {
        _uiState.update { it.copy(showToc = !it.showToc) }
    }

    fun toggleBookmark() {
        val s = _uiState.value
        val bookId = s.book?.id ?: return
        viewModelScope.launch {
            bookRepo.toggleBookmark(bookId, s.currentPage)
            _uiState.update { it.copy(isBookmarked = !it.isBookmarked) }
        }
    }

    // ─── Settings ────────────────────────────────────────────────────────────

    fun updateTheme(theme: AppTheme) { viewModelScope.launch { settingsRepo.updateTheme(theme) } }
    fun updateViewMode(mode: ViewMode) { viewModelScope.launch { settingsRepo.updateViewMode(mode) } }
    fun updateBrightness(v: Float) { viewModelScope.launch { settingsRepo.updateBrightness(v) } }
    fun updateRenderQuality(q: Int) {
        viewModelScope.launch {
            settingsRepo.updateRenderQuality(q)
            synchronized(pageCache) { pageCache.clear() }
            renderPage(_uiState.value.currentPage)
        }
    }
    fun updateAutoNightMode(v: Boolean) { viewModelScope.launch { settingsRepo.updateAutoNightMode(v) } }
    fun updateAutoScroll(enabled: Boolean, speed: Float) { viewModelScope.launch { settingsRepo.updateAutoScroll(enabled, speed) } }
    fun updateMusic(trackId: String?) { viewModelScope.launch { settingsRepo.updateMusic(trackId) } }
    fun updateVolume(v: Float) { viewModelScope.launch { settingsRepo.updateVolume(v) } }

    // ─── TTS ─────────────────────────────────────────────────────────────────

    fun updateTtsEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepo.updateTts(
                enabled = enabled,
                voice = _uiState.value.settings.ttsVoice,
                speed = _uiState.value.settings.ttsSpeed
            )
            if (!enabled) {
                ttsManager.stop()
                _uiState.update { it.copy(isTtsSpeaking = false) }
            }
        }
    }

    fun updateTtsVoice(voice: TtsVoice) {
        viewModelScope.launch {
            settingsRepo.updateTts(
                enabled = _uiState.value.settings.ttsEnabled,
                voice = voice,
                speed = _uiState.value.settings.ttsSpeed
            )
        }
    }

    fun updateTtsSpeed(speed: Float) {
        viewModelScope.launch {
            settingsRepo.updateTts(
                enabled = _uiState.value.settings.ttsEnabled,
                voice = _uiState.value.settings.ttsVoice,
                speed = speed
            )
        }
    }

    fun speakCurrentPage() {
        val s = _uiState.value
        val filePath = currentFilePath ?: return
        val page = s.currentPage
        val settings = s.settings

        viewModelScope.launch {
            _uiState.update { it.copy(isTtsSpeaking = true, ttsError = null) }
            val text = ttsManager.extractPageText(File(filePath), page - 1)
            if (text.isBlank()) {
                _uiState.update { it.copy(isTtsSpeaking = false, ttsError = "No readable text found on this page.") }
                return@launch
            }
            _uiState.update { it.copy(ttsPageText = text) }
            ttsManager.speak(
                text = text,
                voice = settings.ttsVoice,
                speed = settings.ttsSpeed,
                onDone = {
                    viewModelScope.launch {
                        _uiState.update { it.copy(isTtsSpeaking = false) }
                        // Auto-advance in TTS mode
                        if (settings.ttsEnabled && s.currentPage < s.totalPages) {
                            delay(800)
                            nextPage()
                        }
                    }
                },
                onError = {
                    viewModelScope.launch {
                        _uiState.update { it.copy(isTtsSpeaking = false, ttsError = "TTS error occurred.") }
                    }
                }
            )
        }
    }

    fun stopTts() {
        ttsManager.stop()
        _uiState.update { it.copy(isTtsSpeaking = false) }
    }

    fun dismissAchievement() {
        _uiState.update { it.copy(newAchievement = null) }
    }

    fun dismissTtsError() {
        _uiState.update { it.copy(ttsError = null) }
    }

    // ─── PDF Rendering ────────────────────────────────────────────────────────

    private fun renderPage(pageIndex: Int) {
        val renderer = pdfRenderer ?: return
        renderJob?.cancel()
        renderJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                val cached = synchronized(pageCache) { pageCache[pageIndex] }
                if (cached != null && !cached.isRecycled) {
                    withContext(Dispatchers.Main) { _renderedPage.value = cached }
                    preloadAdjacentPages(pageIndex)
                    return@launch
                }
                val bitmap = renderPageToBitmap(renderer, pageIndex - 1)
                if (bitmap != null) {
                    synchronized(pageCache) {
                        evictIfNeeded()
                        pageCache[pageIndex] = bitmap
                    }
                    withContext(Dispatchers.Main) { _renderedPage.value = bitmap }
                }
                preloadAdjacentPages(pageIndex)
            } catch (_: CancellationException) {
            } catch (e: Exception) {
                Log.e(TAG, "Render error page $pageIndex", e)
            }
        }
    }

    private fun renderPageToBitmap(renderer: PdfRenderer, index: Int): Bitmap? {
        if (index < 0 || index >= renderer.pageCount) return null
        val quality = _uiState.value.settings.renderQuality.coerceIn(1, 4)
        val scale   = _uiState.value.zoomScale
        return try {
            val page = renderer.openPage(index)
            val screenWidth = context.resources.displayMetrics.widthPixels
            val pageScale   = screenWidth.toFloat() / page.width
            val w = (page.width  * pageScale * scale * quality).toInt().coerceAtMost(4096)
            val h = (page.height * pageScale * scale * quality).toInt().coerceAtMost(4096)
            val bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            bm.eraseColor(android.graphics.Color.WHITE)
            page.render(bm, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()
            bm
        } catch (e: Exception) {
            Log.w(TAG, "renderPage failed at ${index + 1}", e)
            null
        }
    }

    private fun evictIfNeeded() {
        while (pageCache.size >= LRU_CACHE_SIZE) {
            val key = pageCache.keys.first()
            pageCache[key]?.recycle()
            pageCache.remove(key)
        }
    }

    private suspend fun preloadAdjacentPages(current: Int) {
        val renderer = pdfRenderer ?: return
        val total = _uiState.value.totalPages
        withContext(Dispatchers.IO) {
            listOf(current + 1, current - 1, current + 2, current + 3).forEach { adj ->
                if (adj > 0 && adj <= total) {
                    val cached = synchronized(pageCache) { pageCache[adj] }
                    if (cached == null || cached.isRecycled) {
                        val bm = renderPageToBitmap(renderer, adj - 1)
                        if (bm != null) {
                            synchronized(pageCache) { evictIfNeeded(); pageCache[adj] = bm }
                        }
                    }
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        renderJob?.cancel()
        hudJob?.cancel()
        settingsJob?.cancel()
        ttsManager.stop()
        pdfRenderer?.close()
        pfd?.close()
        synchronized(pageCache) { pageCache.values.forEach { it.recycle() }; pageCache.clear() }
    }
}
