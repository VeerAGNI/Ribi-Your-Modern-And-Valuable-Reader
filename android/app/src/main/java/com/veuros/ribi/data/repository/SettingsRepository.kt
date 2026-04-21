package com.veuros.ribi.data.repository

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.veuros.ribi.data.local.SettingsDataStore
import com.veuros.ribi.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepository @Inject constructor(
    private val dataStore: SettingsDataStore,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    companion object { private const val TAG = "SettingsRepository" }

    val settings: Flow<ReaderSettings> = dataStore.settingsFlow

    suspend fun updateTheme(theme: AppTheme) {
        dataStore.updateSettings { it[SettingsDataStore.KEY_THEME] = theme.name }
        syncToFirestore()
    }

    suspend fun updateViewMode(mode: ViewMode) {
        dataStore.updateSettings { it[SettingsDataStore.KEY_VIEW_MODE] = mode.name }
    }

    suspend fun updateBrightness(brightness: Float) {
        dataStore.updateSettings { it[SettingsDataStore.KEY_BRIGHTNESS] = brightness }
    }

    suspend fun updateRenderQuality(quality: Int) {
        dataStore.updateSettings { it[SettingsDataStore.KEY_RENDER_QUALITY] = quality }
    }

    suspend fun updateAutoNightMode(enabled: Boolean) {
        dataStore.updateSettings { it[SettingsDataStore.KEY_AUTO_NIGHT_MODE] = enabled }
    }

    suspend fun updateAutoScroll(enabled: Boolean, speed: Float) {
        dataStore.updateSettings {
            it[SettingsDataStore.KEY_AUTO_SCROLL] = enabled
            it[SettingsDataStore.KEY_SCROLL_SPEED] = speed
        }
    }

    suspend fun updateMusic(trackId: String?) {
        dataStore.updateSettings {
            if (trackId != null) it[SettingsDataStore.KEY_BG_MUSIC] = trackId
            else it.remove(SettingsDataStore.KEY_BG_MUSIC)
        }
    }

    suspend fun updateVolume(volume: Float) {
        dataStore.updateSettings { it[SettingsDataStore.KEY_VOLUME] = volume }
    }

    suspend fun updateStats(stats: ReadingStats) {
        dataStore.updateStats(stats)
        syncToFirestore()
    }

    suspend fun setAdminDevice(value: Boolean) = dataStore.setAdminDevice(value)
    val isAdminDevice = dataStore.isAdminDevice
    val seenTip = dataStore.seenTip
    suspend fun setSeenTip() = dataStore.setSeenTip()

    private suspend fun syncToFirestore() {
        val uid = auth.currentUser?.uid ?: return
        withContext(Dispatchers.IO) {
            try {
                val s = dataStore.settingsFlow.first()
                val data = mapOf(
                    "theme"          to s.theme.name,
                    "viewMode"       to s.viewMode.name,
                    "brightness"     to s.brightness,
                    "renderQuality"  to s.renderQuality,
                    "autoNightMode"  to s.autoNightMode,
                    "backgroundMusic" to s.backgroundMusic,
                    "volume"         to s.volume,
                    "stats"          to mapOf(
                        "totalPagesRead"       to s.stats.totalPagesRead,
                        "unlockedAchievements" to s.stats.unlockedAchievements,
                        "streak"               to s.stats.streak,
                        "longestStreak"        to s.stats.longestStreak,
                        "lastReadDate"         to s.stats.lastReadDate,
                        "totalReadingMins"     to s.stats.totalReadingMins
                    )
                )
                firestore.collection("users").document(uid)
                    .collection("settings").document("reader")
                    .set(data, SetOptions.merge())
                    .await()
            } catch (e: Exception) {
                Log.w(TAG, "Settings sync failed", e)
            }
        }
    }

    suspend fun loadFromFirestore() {
        val uid = auth.currentUser?.uid ?: return
        withContext(Dispatchers.IO) {
            try {
                val doc = firestore.collection("users").document(uid)
                    .collection("settings").document("reader")
                    .get().await()
                if (!doc.exists()) return@withContext
                val theme = doc.getString("theme")?.let {
                    runCatching { AppTheme.valueOf(it) }.getOrNull()
                } ?: AppTheme.LIGHT
                val mode = doc.getString("viewMode")?.let {
                    runCatching { ViewMode.valueOf(it) }.getOrNull()
                } ?: ViewMode.PAGE
                val brightness = (doc.getDouble("brightness") ?: 1.0).toFloat()
                val quality = (doc.getLong("renderQuality") ?: 2).toInt()
                val autoNight = doc.getBoolean("autoNightMode") ?: false
                val music = doc.getString("backgroundMusic")
                val volume = (doc.getDouble("volume") ?: 0.5).toFloat()

                val statsMap = doc.get("stats") as? Map<*, *>
                val stats = if (statsMap != null) {
                    val achievements = (statsMap["unlockedAchievements"] as? List<*>)
                        ?.filterIsInstance<String>() ?: emptyList()
                    ReadingStats(
                        totalPagesRead       = (statsMap["totalPagesRead"] as? Long)?.toInt() ?: 0,
                        unlockedAchievements = achievements,
                        streak               = (statsMap["streak"] as? Long)?.toInt() ?: 0,
                        longestStreak        = (statsMap["longestStreak"] as? Long)?.toInt() ?: 0,
                        lastReadDate         = statsMap["lastReadDate"] as? String ?: "",
                        totalReadingMins     = (statsMap["totalReadingMins"] as? Long)?.toInt() ?: 0
                    )
                } else ReadingStats()

                dataStore.updateSettings {
                    it[SettingsDataStore.KEY_THEME]          = theme.name
                    it[SettingsDataStore.KEY_VIEW_MODE]      = mode.name
                    it[SettingsDataStore.KEY_BRIGHTNESS]     = brightness
                    it[SettingsDataStore.KEY_RENDER_QUALITY] = quality
                    it[SettingsDataStore.KEY_AUTO_NIGHT_MODE] = autoNight
                    it[SettingsDataStore.KEY_VOLUME]         = volume
                    if (music != null) it[SettingsDataStore.KEY_BG_MUSIC] = music
                }
                dataStore.updateStats(stats)
            } catch (e: Exception) {
                Log.w(TAG, "Load from Firestore failed", e)
            }
        }
    }
}
