package com.veuros.ribi.ui.home

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.veuros.ribi.data.model.*
import com.veuros.ribi.data.repository.BookRepository
import com.veuros.ribi.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

data class HomeUiState(
    val books: List<BookMetadata> = emptyList(),
    val settings: ReaderSettings = ReaderSettings(),
    val userName: String = "",
    val isImporting: Boolean = false,
    val importError: String? = null,
    val newAchievement: Pair<String, String>? = null,   // title, icon
    val seenTip: Boolean = false,
    val drawerTab: DrawerTab = DrawerTab.LIBRARY,
    val activeBookId: String? = null
)

enum class DrawerTab { LIBRARY, SETTINGS, BOOKMARKS, ABOUT }

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val bookRepo: BookRepository,
    private val settingsRepo: SettingsRepository,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch { settingsRepo.loadFromFirestore() }

        viewModelScope.launch {
            bookRepo.books.collect { books ->
                _uiState.update { it.copy(books = books) }
            }
        }
        viewModelScope.launch {
            settingsRepo.settings.collect { settings ->
                val effectiveTheme = applyAutoNightMode(settings)
                _uiState.update { it.copy(settings = settings.copy(theme = effectiveTheme)) }
            }
        }
        viewModelScope.launch {
            settingsRepo.seenTip.collect { seen ->
                _uiState.update { it.copy(seenTip = seen) }
            }
        }
        _uiState.update { it.copy(userName = auth.currentUser?.displayName?.split(" ")?.firstOrNull() ?: "") }
    }

    private fun applyAutoNightMode(settings: ReaderSettings): AppTheme {
        if (!settings.autoNightMode) return settings.theme
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return if (hour >= 21 || hour < 6) AppTheme.MIDNIGHT else settings.theme
    }

    fun importPdf(uri: Uri, customTitle: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isImporting = true, importError = null) }
            val result = bookRepo.importPdf(uri, customTitle)
            result.onSuccess {
                _uiState.update { it.copy(isImporting = false) }
            }.onFailure { e ->
                _uiState.update { it.copy(isImporting = false, importError = e.message) }
            }
        }
    }

    fun deleteBook(bookId: String) {
        viewModelScope.launch { bookRepo.deleteBook(bookId) }
    }

    fun renameBook(bookId: String, title: String) {
        viewModelScope.launch { bookRepo.renameBook(bookId, title) }
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
        viewModelScope.launch { settingsRepo.updateRenderQuality(quality) }
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

    fun setDrawerTab(tab: DrawerTab) {
        _uiState.update { it.copy(drawerTab = tab) }
    }

    fun setSeenTip() {
        viewModelScope.launch { settingsRepo.setSeenTip() }
    }

    fun dismissAchievement() {
        _uiState.update { it.copy(newAchievement = null) }
    }

    fun onPageRead(bookId: String, newPage: Int) {
        viewModelScope.launch {
            bookRepo.updateProgress(bookId, newPage)
            checkAchievements(newPage)
            updateStreak()
        }
    }

    private suspend fun checkAchievements(currentPage: Int) {
        val settings = _uiState.value.settings
        val stats = settings.stats
        val newTotal = stats.totalPagesRead + 1
        val unlocked = stats.unlockedAchievements.toMutableList()

        AchievementList.pageAchievements.forEach { ach ->
            if (newTotal >= ach.pages && !unlocked.contains(ach.id)) {
                unlocked.add(ach.id)
                _uiState.update { it.copy(newAchievement = ach.title to ach.icon) }
            }
        }

        val updated = stats.copy(totalPagesRead = newTotal, unlockedAchievements = unlocked)
        settingsRepo.updateStats(updated)
    }

    private suspend fun updateStreak() {
        val settings = _uiState.value.settings
        val stats = settings.stats
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val yesterday = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            .format(Date(System.currentTimeMillis() - 86400000L))

        val newStreak = when (stats.lastReadDate) {
            today     -> stats.streak
            yesterday -> stats.streak + 1
            else      -> 1
        }
        val newLongest = maxOf(stats.longestStreak, newStreak)

        // Check streak achievements
        if (newStreak > stats.streak) {
            AchievementList.streakAchievements.forEach { sa ->
                if (newStreak >= sa.days && !stats.unlockedAchievements.contains("streak_${sa.days}")) {
                    _uiState.update { it.copy(newAchievement = sa.title to sa.icon) }
                }
            }
        }

        val updated = stats.copy(
            streak        = newStreak,
            longestStreak = newLongest,
            lastReadDate  = today
        )
        settingsRepo.updateStats(updated)
    }

    fun toggleBookmark(bookId: String, page: Int) {
        viewModelScope.launch { bookRepo.toggleBookmark(bookId, page) }
    }
}
