package com.veuros.ribi.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.veuros.ribi.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "ribi_settings")

class SettingsDataStore(private val context: Context) {

    companion object {
        val KEY_THEME           = stringPreferencesKey("theme")
        val KEY_VIEW_MODE       = stringPreferencesKey("view_mode")
        val KEY_FONT_FAMILY     = stringPreferencesKey("font_family")
        val KEY_FONT_SIZE       = intPreferencesKey("font_size")
        val KEY_AUTO_SCROLL     = booleanPreferencesKey("auto_scroll")
        val KEY_SCROLL_SPEED    = floatPreferencesKey("scroll_speed")
        val KEY_BG_MUSIC        = stringPreferencesKey("bg_music")
        val KEY_VOLUME          = floatPreferencesKey("volume")
        val KEY_BRIGHTNESS      = floatPreferencesKey("brightness")
        val KEY_RENDER_QUALITY  = intPreferencesKey("render_quality")
        val KEY_AUTO_NIGHT_MODE = booleanPreferencesKey("auto_night_mode")
        // TTS
        val KEY_TTS_ENABLED     = booleanPreferencesKey("tts_enabled")
        val KEY_TTS_VOICE       = stringPreferencesKey("tts_voice")
        val KEY_TTS_SPEED       = floatPreferencesKey("tts_speed")
        // Stats
        val KEY_TOTAL_PAGES     = intPreferencesKey("total_pages")
        val KEY_ACHIEVEMENTS    = stringPreferencesKey("achievements")
        val KEY_STREAK          = intPreferencesKey("streak")
        val KEY_LONGEST_STREAK  = intPreferencesKey("longest_streak")
        val KEY_LAST_READ_DATE  = stringPreferencesKey("last_read_date")
        val KEY_TOTAL_MINS      = intPreferencesKey("total_mins")
        // Admin
        val KEY_IS_ADMIN_DEVICE = booleanPreferencesKey("is_admin_device")
        val KEY_IS_GUEST        = booleanPreferencesKey("is_guest")
        // Tips
        val KEY_SEEN_TIP        = booleanPreferencesKey("seen_tip")
    }

    val settingsFlow: Flow<ReaderSettings> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) emit(emptyPreferences())
            else throw exception
        }
        .map { prefs -> prefs.toReaderSettings() }

    suspend fun updateSettings(update: suspend (MutablePreferences) -> Unit) {
        context.dataStore.edit { prefs -> update(prefs) }
    }

    suspend fun updateStats(stats: ReadingStats) {
        context.dataStore.edit { prefs ->
            prefs[KEY_TOTAL_PAGES]    = stats.totalPagesRead
            prefs[KEY_ACHIEVEMENTS]   = stats.unlockedAchievements.joinToString(",")
            prefs[KEY_STREAK]         = stats.streak
            prefs[KEY_LONGEST_STREAK] = stats.longestStreak
            prefs[KEY_LAST_READ_DATE] = stats.lastReadDate
            prefs[KEY_TOTAL_MINS]     = stats.totalReadingMins
        }
    }

    private fun Preferences.toReaderSettings(): ReaderSettings {
        val themeStr   = this[KEY_THEME] ?: "LIGHT"
        val modeStr    = this[KEY_VIEW_MODE] ?: "PAGE"
        val fontStr    = this[KEY_FONT_FAMILY] ?: "SANS"
        val ttsVoiceStr = this[KEY_TTS_VOICE] ?: "FEMALE"
        val theme      = runCatching { AppTheme.valueOf(themeStr) }.getOrDefault(AppTheme.LIGHT)
        val viewMode   = runCatching { ViewMode.valueOf(modeStr) }.getOrDefault(ViewMode.PAGE)
        val fontFamily = runCatching { FontFamily.valueOf(fontStr) }.getOrDefault(FontFamily.SANS)
        val ttsVoice   = runCatching { TtsVoice.valueOf(ttsVoiceStr) }.getOrDefault(TtsVoice.FEMALE)
        val achievements = (this[KEY_ACHIEVEMENTS] ?: "")
            .split(",").filter { it.isNotBlank() }

        return ReaderSettings(
            theme           = theme,
            viewMode        = viewMode,
            fontFamily      = fontFamily,
            fontSize        = this[KEY_FONT_SIZE] ?: 100,
            isAutoScrolling = this[KEY_AUTO_SCROLL] ?: false,
            autoScrollSpeed = this[KEY_SCROLL_SPEED] ?: 0f,
            backgroundMusic = this[KEY_BG_MUSIC],
            volume          = this[KEY_VOLUME] ?: 0.5f,
            brightness      = this[KEY_BRIGHTNESS] ?: 1.0f,
            renderQuality   = this[KEY_RENDER_QUALITY] ?: 2,
            autoNightMode   = this[KEY_AUTO_NIGHT_MODE] ?: false,
            ttsEnabled      = this[KEY_TTS_ENABLED] ?: false,
            ttsVoice        = ttsVoice,
            ttsSpeed        = this[KEY_TTS_SPEED] ?: 0.75f,
            stats = ReadingStats(
                totalPagesRead       = this[KEY_TOTAL_PAGES] ?: 0,
                unlockedAchievements = achievements,
                streak               = this[KEY_STREAK] ?: 0,
                longestStreak        = this[KEY_LONGEST_STREAK] ?: 0,
                lastReadDate         = this[KEY_LAST_READ_DATE] ?: "",
                totalReadingMins     = this[KEY_TOTAL_MINS] ?: 0
            )
        )
    }

    val isAdminDevice: Flow<Boolean> = context.dataStore.data.map { it[KEY_IS_ADMIN_DEVICE] ?: false }
    val isGuest: Flow<Boolean>       = context.dataStore.data.map { it[KEY_IS_GUEST] ?: false }
    val seenTip: Flow<Boolean>       = context.dataStore.data.map { it[KEY_SEEN_TIP] ?: false }

    suspend fun setAdminDevice(value: Boolean) {
        context.dataStore.edit { it[KEY_IS_ADMIN_DEVICE] = value }
    }
    suspend fun setGuest(value: Boolean) {
        context.dataStore.edit { it[KEY_IS_GUEST] = value }
    }
    suspend fun setSeenTip() {
        context.dataStore.edit { it[KEY_SEEN_TIP] = true }
    }
}
