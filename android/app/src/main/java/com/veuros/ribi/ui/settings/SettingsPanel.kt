package com.veuros.ribi.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.veuros.ribi.data.model.*

@Composable
fun SettingsPanel(
    settings: ReaderSettings,
    bgColor: Color,
    textColor: Color,
    accentColor: Color,
    onThemeChange: (AppTheme) -> Unit,
    onViewModeChange: (ViewMode) -> Unit,
    onBrightnessChange: (Float) -> Unit,
    onRenderQualityChange: (Int) -> Unit,
    onAutoNightModeChange: (Boolean) -> Unit,
    onAutoScrollChange: (Boolean, Float) -> Unit,
    onMusicChange: (String?) -> Unit,
    onVolumeChange: (Float) -> Unit,
    onTtsEnabledChange: (Boolean) -> Unit = {},
    onTtsVoiceChange: (TtsVoice) -> Unit = {},
    onTtsSpeedChange: (Float) -> Unit = {}
) {
    val scrollState = rememberScrollState()
    val dividerColor = textColor.copy(0.08f)
    val cardBg = textColor.copy(0.04f)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {

        // ── APPEARANCE ────────────────────────────────────────────────────────
        SectionHeader("APPEARANCE", textColor)

        SettingsCard(bg = cardBg) {
            // Theme selector
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SettingsLabel("Theme", Icons.Default.Palette, textColor)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        AppTheme.LIGHT    to Pair(Icons.Default.LightMode,  "Light"),
                        AppTheme.DARK     to Pair(Icons.Default.DarkMode,   "Dark"),
                        AppTheme.SEPIA    to Pair(Icons.Default.LocalCafe,  "Sepia"),
                        AppTheme.NORD     to Pair(Icons.Default.Cloud,      "Nord"),
                        AppTheme.MIDNIGHT to Pair(Icons.Default.Nightlight, "Night")
                    ).forEach { (theme, pair) ->
                        val (icon, label) = pair
                        val active = settings.theme == theme
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) accentColor.copy(0.15f) else Color.Transparent)
                                .border(1.dp, if (active) accentColor else textColor.copy(0.12f), RoundedCornerShape(12.dp))
                                .clickable { onThemeChange(theme) }
                                .padding(vertical = 10.dp, horizontal = 4.dp)
                        ) {
                            Icon(icon, null,
                                tint = if (active) accentColor else textColor.copy(0.5f),
                                modifier = Modifier.size(18.dp))
                            Spacer(Modifier.height(4.dp))
                            Text(label, fontSize = 9.sp,
                                color = if (active) accentColor else textColor.copy(0.5f),
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }
            }

            HorizontalDivider(color = dividerColor)

            // Auto Night Mode
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.BedtimeOff, null, tint = textColor.copy(0.6f), modifier = Modifier.size(18.dp))
                    Column {
                        Text("Auto Night Mode", color = textColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text("Midnight theme after 9PM", color = textColor.copy(0.45f), fontSize = 11.sp)
                    }
                }
                Switch(
                    checked = settings.autoNightMode,
                    onCheckedChange = onAutoNightModeChange,
                    colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = accentColor)
                )
            }
        }

        // ── DISPLAY ───────────────────────────────────────────────────────────
        SectionHeader("DISPLAY", textColor)

        SettingsCard(bg = cardBg) {
            // Brightness
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    SettingsLabel("Brightness", Icons.Default.WbSunny, textColor)
                    Text("${(settings.brightness * 100).toInt()}%", color = textColor.copy(0.5f), fontSize = 12.sp)
                }
                Slider(
                    value = settings.brightness,
                    onValueChange = onBrightnessChange,
                    valueRange = 0.2f..1.0f,
                    modifier = Modifier.fillMaxWidth(),
                    colors = sliderColors(accentColor)
                )
            }

            HorizontalDivider(color = dividerColor)

            // Render Quality
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    SettingsLabel("PDF Sharpness", Icons.Default.HighQuality, textColor)
                    Text(qualityLabel(settings.renderQuality), color = textColor.copy(0.5f), fontSize = 12.sp)
                }
                Slider(
                    value = settings.renderQuality.toFloat(),
                    onValueChange = { onRenderQualityChange(it.toInt()) },
                    valueRange = 1f..4f,
                    steps = 2,
                    modifier = Modifier.fillMaxWidth(),
                    colors = sliderColors(accentColor)
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Draft", color = textColor.copy(0.35f), fontSize = 10.sp)
                    Text("Ultra", color = textColor.copy(0.35f), fontSize = 10.sp)
                }
            }

            HorizontalDivider(color = dividerColor)

            // View Mode
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SettingsLabel("View Mode", Icons.Default.ViewAgenda, textColor)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ViewMode.entries.forEach { mode ->
                        val active = settings.viewMode == mode
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) accentColor.copy(0.12f) else Color.Transparent)
                                .border(1.dp, if (active) accentColor else textColor.copy(0.12f), RoundedCornerShape(12.dp))
                                .clickable { onViewModeChange(mode) }
                                .padding(vertical = 12.dp, horizontal = 14.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                if (mode == ViewMode.PAGE) Icons.Default.Article else Icons.Default.ViewStream,
                                null,
                                tint = if (active) accentColor else textColor.copy(0.5f),
                                modifier = Modifier.size(16.dp)
                            )
                            Text(mode.displayName, fontSize = 13.sp,
                                color = if (active) accentColor else textColor.copy(0.7f),
                                fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
                        }
                    }
                }
            }
        }

        // ── AUTO SCROLL ───────────────────────────────────────────────────────
        SectionHeader("AUTO SCROLL", textColor)

        SettingsCard(bg = cardBg) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SettingsLabel("Auto Scroll", Icons.Default.AutoMode, textColor)
                Switch(
                    checked = settings.isAutoScrolling,
                    onCheckedChange = { onAutoScrollChange(it, settings.autoScrollSpeed) },
                    colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = accentColor)
                )
            }
            if (settings.isAutoScrolling) {
                HorizontalDivider(color = dividerColor)
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        SettingsLabel("Speed", Icons.Default.Speed, textColor)
                        Text("${settings.autoScrollSpeed.toInt()} px/s", color = textColor.copy(0.5f), fontSize = 12.sp)
                    }
                    Slider(
                        value = settings.autoScrollSpeed,
                        onValueChange = { onAutoScrollChange(true, it) },
                        valueRange = 5f..100f,
                        modifier = Modifier.fillMaxWidth(),
                        colors = sliderColors(accentColor)
                    )
                }
            }
        }

        // ── TTS ───────────────────────────────────────────────────────────────
        SectionHeader("READ ALOUD (TTS)", textColor)

        SettingsCard(bg = cardBg) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.RecordVoiceOver, null, tint = textColor.copy(0.6f), modifier = Modifier.size(18.dp))
                    Column {
                        Text("Read Aloud", color = textColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text("Auto-reads PDF page text", color = textColor.copy(0.45f), fontSize = 11.sp)
                    }
                }
                Switch(
                    checked = settings.ttsEnabled,
                    onCheckedChange = onTtsEnabledChange,
                    colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = accentColor)
                )
            }

            if (settings.ttsEnabled) {
                HorizontalDivider(color = dividerColor)

                // Voice selection
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SettingsLabel("Voice", Icons.Default.Person, textColor)
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        TtsVoice.entries.forEach { voice ->
                            val active = settings.ttsVoice == voice
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (active) accentColor.copy(0.12f) else Color.Transparent)
                                    .border(1.dp, if (active) accentColor else textColor.copy(0.12f), RoundedCornerShape(12.dp))
                                    .clickable { onTtsVoiceChange(voice) }
                                    .padding(vertical = 12.dp, horizontal = 14.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    if (voice == TtsVoice.FEMALE) Icons.Default.RecordVoiceOver else Icons.Default.VoiceChat,
                                    null,
                                    tint = if (active) accentColor else textColor.copy(0.5f),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(voice.displayName, fontSize = 13.sp,
                                    color = if (active) accentColor else textColor.copy(0.7f),
                                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
                            }
                        }
                    }
                }

                HorizontalDivider(color = dividerColor)

                // Speed
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        SettingsLabel("Reading Speed", Icons.Default.Speed, textColor)
                        Text(ttsSpeedLabel(settings.ttsSpeed), color = textColor.copy(0.5f), fontSize = 12.sp)
                    }
                    Slider(
                        value = settings.ttsSpeed,
                        onValueChange = onTtsSpeedChange,
                        valueRange = 0.4f..1.5f,
                        modifier = Modifier.fillMaxWidth(),
                        colors = sliderColors(accentColor)
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Very slow", color = textColor.copy(0.35f), fontSize = 10.sp)
                        Text("Fast", color = textColor.copy(0.35f), fontSize = 10.sp)
                    }
                }
            }
        }

        // ── MUSIC ─────────────────────────────────────────────────────────────
        SectionHeader("BACKGROUND MUSIC", textColor)

        SettingsCard(bg = cardBg) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Off option
                MusicOption(
                    label = "Off",
                    icon = Icons.Default.MusicOff,
                    selected = settings.backgroundMusic == null,
                    accentColor = accentColor, textColor = textColor,
                    onClick = { onMusicChange(null) }
                )
                BackgroundTracks.tracks.forEach { track ->
                    MusicOption(
                        label = track.name,
                        icon = Icons.Default.MusicNote,
                        selected = settings.backgroundMusic == track.id,
                        accentColor = accentColor, textColor = textColor,
                        onClick = { onMusicChange(track.id) }
                    )
                }
            }

            if (settings.backgroundMusic != null) {
                HorizontalDivider(color = dividerColor)
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        SettingsLabel("Volume", Icons.Default.VolumeUp, textColor)
                        Text("${(settings.volume * 100).toInt()}%", color = textColor.copy(0.5f), fontSize = 12.sp)
                    }
                    Slider(
                        value = settings.volume,
                        onValueChange = onVolumeChange,
                        valueRange = 0f..1f,
                        modifier = Modifier.fillMaxWidth(),
                        colors = sliderColors(accentColor)
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

@Composable
private fun SectionHeader(title: String, textColor: Color) {
    Text(
        text = title,
        color = textColor.copy(0.35f),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.5.sp,
        modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 2.dp)
    )
}

@Composable
private fun SettingsCard(bg: Color, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(bg),
        content = content
    )
}

@Composable
private fun SettingsLabel(text: String, icon: ImageVector, textColor: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, tint = textColor.copy(0.55f), modifier = Modifier.size(16.dp))
        Text(text, color = textColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun MusicOption(label: String, icon: ImageVector, selected: Boolean, accentColor: Color, textColor: Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) accentColor.copy(0.1f) else Color.Transparent)
            .border(1.dp, if (selected) accentColor.copy(0.4f) else textColor.copy(0.08f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(icon, null,
            tint = if (selected) accentColor else textColor.copy(0.45f),
            modifier = Modifier.size(16.dp))
        Text(label, fontSize = 13.sp,
            color = if (selected) accentColor else textColor.copy(0.75f),
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            modifier = Modifier.weight(1f))
        if (selected) {
            Icon(Icons.Default.CheckCircle, null, tint = accentColor, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun sliderColors(accentColor: Color) = SliderDefaults.colors(
    thumbColor = accentColor,
    activeTrackColor = accentColor,
    inactiveTrackColor = accentColor.copy(0.2f)
)

private fun qualityLabel(quality: Int) = when (quality) {
    1 -> "Draft"; 2 -> "Standard"; 3 -> "High"; else -> "Ultra"
}

private fun ttsSpeedLabel(speed: Float) = when {
    speed < 0.55f -> "Very Slow"
    speed < 0.75f -> "Slow"
    speed < 1.0f  -> "Normal"
    speed < 1.25f -> "Fast"
    else          -> "Very Fast"
}
