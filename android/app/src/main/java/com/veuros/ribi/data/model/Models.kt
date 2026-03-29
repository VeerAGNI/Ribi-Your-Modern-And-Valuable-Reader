package com.veuros.ribi.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

// ─── Enums ───────────────────────────────────────────────────────────────────

enum class AppTheme(val displayName: String) {
    LIGHT("Light"),
    DARK("Dark"),
    SEPIA("Sepia"),
    NORD("Nord"),
    MIDNIGHT("Midnight")
}

enum class ViewMode(val displayName: String) {
    PAGE("Single Page"),
    CONTINUOUS("Continuous")
}

enum class FontFamily(val displayName: String, val cssName: String) {
    SANS("Sans-serif", "sans-serif"),
    SERIF("Serif", "serif"),
    MONO("Monospace", "monospace"),
    BOOK("Book", "serif")
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────

data class ThemeColors(
    val bg: Long,
    val text: Long,
    val accent: Long,
    val secondary: Long
)

object AppThemes {
    val map = mapOf(
        AppTheme.LIGHT    to ThemeColors(0xFFFFFFFF, 0xFF1A1A1A, 0xFF3B82F6, 0xFFF3F4F6),
        AppTheme.DARK     to ThemeColors(0xFF111827, 0xFFF9FAFB, 0xFF60A5FA, 0xFF1F2937),
        AppTheme.SEPIA    to ThemeColors(0xFFF4ECD8, 0xFF5B4636, 0xFF946B49, 0xFFEAE0C9),
        AppTheme.NORD     to ThemeColors(0xFF2E3440, 0xFFECEFF4, 0xFF88C0D0, 0xFF3B4252),
        AppTheme.MIDNIGHT to ThemeColors(0xFF000000, 0xFFE5E7EB, 0xFF8B5CF6, 0xFF111111),
    )
    fun get(theme: AppTheme) = map[theme] ?: map[AppTheme.LIGHT]!!
}

// ─── Bookmark ─────────────────────────────────────────────────────────────────

data class Bookmark(
    val id: String,
    val pageNumber: Int,
    val label: String,
    val timestamp: Long
)

// ─── Reading Stats ─────────────────────────────────────────────────────────────

data class ReadingStats(
    val totalPagesRead: Int = 0,
    val unlockedAchievements: List<String> = emptyList(),
    val streak: Int = 0,
    val longestStreak: Int = 0,
    val lastReadDate: String = "",
    val totalReadingMins: Int = 0
)

// ─── Reader Settings ──────────────────────────────────────────────────────────

data class ReaderSettings(
    val theme: AppTheme = AppTheme.LIGHT,
    val viewMode: ViewMode = ViewMode.PAGE,
    val fontFamily: FontFamily = FontFamily.SANS,
    val fontSize: Int = 100,
    val lineHeight: Float = 1.5f,
    val autoScrollSpeed: Float = 0f,
    val isAutoScrolling: Boolean = false,
    val backgroundMusic: String? = null,
    val volume: Float = 0.5f,
    val brightness: Float = 1.0f,
    val renderQuality: Int = 2,
    val autoNightMode: Boolean = false,
    val stats: ReadingStats = ReadingStats()
)

// ─── Book Metadata (Room Entity) ─────────────────────────────────────────────

@Entity(tableName = "books")
@TypeConverters(BookConverters::class)
data class BookMetadata(
    @PrimaryKey val id: String,
    val title: String,
    val originalName: String = "",
    val author: String = "",
    val totalPages: Int = 0,
    val currentPage: Int = 1,
    val maxPageReached: Int = 1,
    val lastRead: Long = System.currentTimeMillis(),
    val bookmarks: List<Bookmark> = emptyList(),
    val coverImagePath: String? = null,
    val filePath: String = ""
)

// ─── TOC Item ─────────────────────────────────────────────────────────────────

data class TocItem(
    val title: String,
    val page: Int,
    val level: Int
)

// ─── Converters ──────────────────────────────────────────────────────────────

class BookConverters {
    private val gson = Gson()

    @TypeConverter
    fun fromBookmarkList(value: List<Bookmark>): String =
        gson.toJson(value)

    @TypeConverter
    fun toBookmarkList(value: String): List<Bookmark> {
        val type = object : TypeToken<List<Bookmark>>() {}.type
        return gson.fromJson(value, type) ?: emptyList()
    }
}

// ─── Achievement Definitions ──────────────────────────────────────────────────

data class Achievement(val id: String, val pages: Int, val title: String, val icon: String)
data class StreakAchievement(val days: Int, val title: String, val icon: String)

object AchievementList {
    val pageAchievements = listOf(
        Achievement("a1",     1,     "The First Step",        "🚶"),
        Achievement("a5",     5,     "Warmed Up",             "🔥"),
        Achievement("a10",    10,    "Getting Into It",       "👀"),
        Achievement("a20",    20,    "Flow State Initiated",  "🌊"),
        Achievement("a50",    50,    "Page Explorer",         "🧭"),
        Achievement("a75",    75,    "Momentum Builder",      "⚡"),
        Achievement("a100",   100,   "Century Mind",          "💯"),
        Achievement("a150",   150,   "Deep Diver",            "🤿"),
        Achievement("a200",   200,   "Story Absorber",        "🧠"),
        Achievement("a300",   300,   "Narrative Navigator",   "🗺️"),
        Achievement("a500",   500,   "Half-K Saga",           "⚔️"),
        Achievement("a750",   750,   "Ink Warrior",           "🗡️"),
        Achievement("a1000",  1000,  "One Thousand Club",     "👑"),
        Achievement("a1500",  1500,  "Mind Architect",        "🏛️"),
        Achievement("a2000",  2000,  "Legendary Reader",      "🌟"),
        Achievement("a3000",  3000,  "Library Within",        "📚"),
        Achievement("a5000",  5000,  "Walking Encyclopedia",  "🧠"),
        Achievement("a7500",  7500,  "Ink Immortal",          "♾️"),
        Achievement("a10000", 10000, "The Grand Scholar",     "🎓"),
    )

    val streakAchievements = listOf(
        StreakAchievement(2,   "Back Again",        "🔥"),
        StreakAchievement(5,   "5-Day Streak",      "🔥"),
        StreakAchievement(7,   "Week Reader",       "🗓️"),
        StreakAchievement(14,  "Two Weeks Strong",  "⚡"),
        StreakAchievement(30,  "Monthly Habit",     "🏆"),
        StreakAchievement(60,  "Reading Machine",   "🤖"),
        StreakAchievement(100, "Century Streak",    "💎"),
        StreakAchievement(365, "Year of Knowledge", "👑"),
    )
}

// ─── Background Music Tracks ──────────────────────────────────────────────────

data class MusicTrack(val id: String, val name: String, val url: String)

object BackgroundTracks {
    val tracks = listOf(
        MusicTrack("gamma", "Gamma Waves",
            "https://cdn.pixabay.com/download/audio/2022/11/08/audio_10f0f8a845.mp3"),
        MusicTrack("rain",  "Soft Rain",
            "https://cdn.pixabay.com/download/audio/2021/08/09/audio_dc39bde808.mp3"),
        MusicTrack("ocean", "Ocean Tides",
            "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3"),
    )
}
