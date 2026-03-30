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

enum class TtsVoice(val displayName: String) {
    FEMALE("Female"),
    MALE("Male")
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────

data class ThemeColors(
    val bg: Long,
    val text: Long,
    val accent: Long,
    val secondary: Long,
    /** ColorMatrix values (20 floats) for PDF page rendering. null = no filter */
    val pdfColorMatrix: FloatArray? = null
)

object AppThemes {
    // PDF Color matrices (4x5, row-major, normalized 0-1 range)
    private val invertMatrix = floatArrayOf(
        -1f,  0f,  0f, 0f, 1f,   // R
         0f, -1f,  0f, 0f, 1f,   // G
         0f,  0f, -1f, 0f, 1f,   // B
         0f,  0f,  0f, 1f, 0f    // A
    )
    private val sepiaMatrix = floatArrayOf(
        0.393f, 0.769f, 0.189f, 0f, 0f,
        0.349f, 0.686f, 0.168f, 0f, 0f,
        0.272f, 0.534f, 0.131f, 0f, 0f,
        0f,     0f,     0f,     1f, 0f
    )
    // Nord: invert with cool blue-gray offset
    private val nordMatrix = floatArrayOf(
        -0.88f, 0f, 0f, 0f, 0.925f,
         0f, -0.88f, 0f, 0f, 0.937f,
         0f,  0f, -0.88f, 0f, 0.976f,
         0f,  0f,  0f,  1f, 0f
    )
    // Midnight: deep invert, very dark
    private val midnightMatrix = floatArrayOf(
        -0.93f, 0f, 0f, 0f, 0.09f,
         0f, -0.93f, 0f, 0f, 0.09f,
         0f,  0f, -0.93f, 0f, 0.09f,
         0f,  0f,  0f,  1f, 0f
    )

    val map = mapOf(
        AppTheme.LIGHT    to ThemeColors(0xFFFFFFFF, 0xFF1A1A1A, 0xFF3B82F6, 0xFFF3F4F6, null),
        AppTheme.DARK     to ThemeColors(0xFF111827, 0xFFF9FAFB, 0xFF60A5FA, 0xFF1F2937, invertMatrix),
        AppTheme.SEPIA    to ThemeColors(0xFFF4ECD8, 0xFF5B4636, 0xFF946B49, 0xFFEAE0C9, sepiaMatrix),
        AppTheme.NORD     to ThemeColors(0xFF2E3440, 0xFFECEFF4, 0xFF88C0D0, 0xFF3B4252, nordMatrix),
        AppTheme.MIDNIGHT to ThemeColors(0xFF000000, 0xFFE5E7EB, 0xFF8B5CF6, 0xFF111111, midnightMatrix),
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
    // TTS
    val ttsEnabled: Boolean = false,
    val ttsVoice: TtsVoice = TtsVoice.FEMALE,
    val ttsSpeed: Float = 0.75f,
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
    fun fromBookmarkList(value: List<Bookmark>): String = gson.toJson(value)

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
        MusicTrack("forest", "Forest Ambience",
            "https://cdn.pixabay.com/download/audio/2022/03/24/audio_1d2b3c4e5f.mp3"),
        MusicTrack("piano", "Gentle Piano",
            "https://cdn.pixabay.com/download/audio/2021/11/15/audio_a1b2c3d4e5.mp3"),
    )
}
