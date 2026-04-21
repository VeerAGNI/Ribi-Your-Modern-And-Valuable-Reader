package com.veuros.ribi.ui.reader

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.veuros.ribi.data.model.*
import com.veuros.ribi.data.repository.BookRepository
import com.veuros.ribi.data.repository.SettingsRepository
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
    val zoomScale: Float = 1.0f
)

@HiltViewModel
class ReaderViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val bookRepo: BookRepository,
    private val settingsRepo: SettingsRepository
) : ViewModel() {

    companion object {
        private const val TAG = "ReaderViewModel"
        private const val LRU_CACHE_SIZE = 8
    }

    private val _uiState = MutableStateFlow(ReaderUiState())
    val uiState: StateFlow<ReaderUiState> = _uiState.asStateFlow()

    // Rendered page bitmaps
    private val _renderedPage = MutableStateFlow<Bitmap?>(null)
    val renderedPage: StateFlow<Bitmap?> = _renderedPage.asStateFlow()

    private val _renderedPages = MutableStateFlow<Map<Int, Bitmap>>(emptyMap())
    val renderedPages: StateFlow<Map<Int, Bitmap>> = _renderedPages.asStateFlow()

    private var pdfRenderer: PdfRenderer? = null
    private var pfd: ParcelFileDescriptor? = null
    private val pageCache = LinkedHashMap<Int, Bitmap>(LRU_CACHE_SIZE, 0.75f, true)
    private var renderJob: Job? = null
    private var hudJob: Job? = null
    private var hudVisible = true

    fun loadBook(bookId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            // Load book metadata
            val book = bookRepo.books.first().find { it.id == bookId }
            if (book == null) {
                _uiState.update { it.copy(isLoading = false, loadError = "Book not found") }
                return@launch
            }

            // Load settings
            val settings = settingsRepo.settings.first()
            val effectiveTheme = if (settings.autoNightMode) {
                val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
                if (hour >= 21 || hour < 6) AppTheme.MIDNIGHT else settings.theme
            } else settings.theme

            // Open PDF renderer
            try {
                val file = File(book.filePath)
                if (!file.exists()) {
                    _uiState.update { it.copy(isLoading = false, loadError = "PDF file not found") }
                    return@launch
                }
                pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                pdfRenderer = PdfRenderer(pfd!!)
                val totalPages = pdfRenderer!!.pageCount

                _uiState.update {
                    it.copy(
                        book = book,
                        settings = settings.copy(theme = effectiveTheme),
                        currentPage = book.currentPage,
                        totalPages = totalPages,
                        isLoading = false,
                        isBookmarked = book.bookmarks.any { bm -> bm.pageNumber == book.currentPage }
                    )
                }

                // Render initial page
                renderPage(book.currentPage)

                // Start HUD auto-hide
                scheduleHudHide()

            } catch (e: Exception) {
                Log.e(TAG, "Failed to open PDF", e)
                _uiState.update { it.copy(isLoading = false, loadError = "Failed to open PDF: ${e.message}") }
            }

            // Observe settings changes
            settingsRepo.settings.collect { s ->
                _uiState.update { it.copy(settings = s) }
            }
        }
    }

    fun goToPage(page: Int) {
        val total = _uiState.value.totalPages
        val clamped = page.coerceIn(1, total)
        if (clamped == _uiState.value.currentPage) return

        _uiState.update {
            val book = it.book
            it.copy(
                currentPage = clamped,
                isBookmarked = book?.bookmarks?.any { bm -> bm.pageNumber == clamped } == true
            )
        }

        renderPage(clamped)

        // Save progress
        viewModelScope.launch {
            val bookId = _uiState.value.book?.id ?: return@launch
            bookRepo.updateProgress(bookId, clamped)
        }
    }

    fun nextPage() {
        val state = _uiState.value
        if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1)
    }

    fun previousPage() {
        val state = _uiState.value
        if (state.currentPage > 1) goToPage(state.currentPage - 1)
    }

    fun zoomIn() {
        val newScale = (_uiState.value.zoomScale + 0.25f).coerceAtMost(4f)
        _uiState.update { it.copy(zoomScale = newScale) }
        re_renderCurrentPage()
    }

    fun zoomOut() {
        val newScale = (_uiState.value.zoomScale - 0.25f).coerceAtLeast(0.5f)
        _uiState.update { it.copy(zoomScale = newScale) }
        re_renderCurrentPage()
    }

    fun resetZoom() {
        _uiState.update { it.copy(zoomScale = 1f) }
        re_renderCurrentPage()
    }

    private fun re_renderCurrentPage() {
        val page = _uiState.value.currentPage
        // Remove from cache to force re-render
        synchronized(pageCache) { pageCache.remove(page) }
        renderPage(page)
    }

    fun toggleHud() {
        hudVisible = !hudVisible
        _uiState.update { it.copy(isHudVisible = hudVisible) }
        if (hudVisible) scheduleHudHide()
    }

    fun showHud() {
        hudVisible = true
        _uiState.update { it.copy(isHudVisible = true) }
        scheduleHudHide()
    }

    private fun scheduleHudHide() {
        hudJob?.cancel()
        hudJob = viewModelScope.launch {
            delay(3000)
            hudVisible = false
            _uiState.update { it.copy(isHudVisible = false) }
        }
    }

    fun toggleToc() {
        _uiState.update { it.copy(showToc = !it.showToc) }
    }

    fun toggleBookmark() {
        val state = _uiState.value
        val bookId = state.book?.id ?: return
        viewModelScope.launch {
            bookRepo.toggleBookmark(bookId, state.currentPage)
            _uiState.update { it.copy(isBookmarked = !it.isBookmarked) }
        }
    }

    fun updateTheme(theme: AppTheme) {
        viewModelScope.launch { settingsRepo.updateTheme(theme) }
    }

    fun updateViewMode(mode: ViewMode) {
        viewModelScope.launch { settingsRepo.updateViewMode(mode) }
    }

    fun updateBrightness(brightness: Float) {
        viewModelScope.launch { settingsRepo.updateBrightness(brightness) }
    }

    fun updateRenderQuality(quality: Int) {
        viewModelScope.launch {
            settingsRepo.updateRenderQuality(quality)
            // Clear cache and re-render
            synchronized(pageCache) { pageCache.clear() }
            renderPage(_uiState.value.currentPage)
        }
    }

    fun updateAutoNightMode(enabled: Boolean) {
        viewModelScope.launch { settingsRepo.updateAutoNightMode(enabled) }
    }

    fun updateAutoScroll(enabled: Boolean, speed: Float) {
        viewModelScope.launch { settingsRepo.updateAutoScroll(enabled, speed) }
    }

    fun updateMusic(trackId: String?) {
        viewModelScope.launch { settingsRepo.updateMusic(trackId) }
    }

    fun updateVolume(volume: Float) {
        viewModelScope.launch { settingsRepo.updateVolume(volume) }
    }

    fun dismissAchievement() {
        _uiState.update { it.copy(newAchievement = null) }
    }

    private fun renderPage(pageIndex: Int) {
        val renderer = pdfRenderer ?: return
        renderJob?.cancel()
        renderJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                // Check cache
                val cached = synchronized(pageCache) { pageCache[pageIndex] }
                if (cached != null && !cached.isRecycled) {
                    _renderedPage.value = cached
                    // Pre-fetch adjacent pages
                    preloadAdjacentPages(pageIndex)
                    return@launch
                }

                val bitmap = renderPageToBitmap(renderer, pageIndex - 1)
                if (bitmap != null) {
                    synchronized(pageCache) {
                        if (pageCache.size >= LRU_CACHE_SIZE) {
                            val oldest = pageCache.keys.first()
                            pageCache[oldest]?.recycle()
                            pageCache.remove(oldest)
                        }
                        pageCache[pageIndex] = bitmap
                    }
                    _renderedPage.value = bitmap
                }

                preloadAdjacentPages(pageIndex)
            } catch (e: CancellationException) {
                // Render cancelled — fine
            } catch (e: Exception) {
                Log.e(TAG, "Error rendering page $pageIndex", e)
            }
        }
    }

    private fun renderPageToBitmap(renderer: PdfRenderer, index: Int): Bitmap? {
        if (index < 0 || index >= renderer.pageCount) return null
        val quality = _uiState.value.settings.renderQuality.coerceIn(1, 4)
        val scale = _uiState.value.zoomScale

        return try {
            val page = renderer.openPage(index)
            val targetWidth = (context.resources.displayMetrics.widthPixels * scale).toInt()
            val pageScale = targetWidth.toFloat() / page.width
            val width  = (page.width * pageScale * quality).toInt().coerceAtMost(4096)
            val height = (page.height * pageScale * quality).toInt().coerceAtMost(4096)

            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(android.graphics.Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()
            bitmap
        } catch (e: Exception) {
            Log.w(TAG, "Failed to render page ${index + 1}", e)
            null
        }
    }

    private suspend fun preloadAdjacentPages(currentIndex: Int) {
        val renderer = pdfRenderer ?: return
        withContext(Dispatchers.IO) {
            listOf(currentIndex + 1, currentIndex - 1, currentIndex + 2).forEach { adj ->
                if (adj > 0 && adj <= _uiState.value.totalPages) {
                    val cached = synchronized(pageCache) { pageCache[adj] }
                    if (cached == null || cached.isRecycled) {
                        val bm = renderPageToBitmap(renderer, adj - 1)
                        if (bm != null) {
                            synchronized(pageCache) {
                                if (pageCache.size >= LRU_CACHE_SIZE) {
                                    val oldest = pageCache.keys.first()
                                    pageCache[oldest]?.recycle()
                                    pageCache.remove(oldest)
                                }
                                pageCache[adj] = bm
                            }
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
        pdfRenderer?.close()
        pfd?.close()
        synchronized(pageCache) {
            pageCache.values.forEach { it.recycle() }
            pageCache.clear()
        }
    }
}
