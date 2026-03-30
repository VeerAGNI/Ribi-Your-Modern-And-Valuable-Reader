-keep class com.veuros.ribi.data.model.** { *; }
-keep class com.google.firebase.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn com.google.firebase.**

# PDFBox Android — text extraction for TTS
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-keep class com.tom_roush.harmony.** { *; }
-dontwarn com.tom_roush.**
-dontwarn org.apache.**
-dontwarn org.bouncycastle.**

# TTS
-keep class android.speech.tts.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Hilt / DI
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Gson
-keep class com.google.gson.** { *; }
-keepclassmembers class * { @com.google.gson.annotations.SerializedName <fields>; }
-keepclassmembers enum * { *; }
