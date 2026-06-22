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
import com.veuros.ribi.ui.components.MusicPlayerPanel

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
    onVolumeChange: (Float) -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(scrollState)
            .padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // ── View Mode ──────────────────────────────────────────────────────────
        SettingsSection(title = "VIEW MODE", textColor = textColor) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(
                    ViewMode.PAGE to "Single Page",
                    ViewMode.CONTINUOUS to "Continuous"
                ).forEach { (mode, label) ->
                    val isSelected = settings.viewMode == mode
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (isSelected) accentColor.copy(0.12f) else textColor.copy(0.06f))
                            .border(
                                if (isSelected) 1.5.dp else 1.dp,
                                if (isSelected) accentColor.copy(0.5f) else textColor.copy(0.1f),
                                RoundedCornerShape(14.dp)
                            )
                            .clickable { onViewModeChange(mode) }
                            .padding(12.dp)
                    ) {
                        Text(
                            text = label,
                            color = if (isSelected) accentColor else textColor.copy(0.7f),
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }

        // ── Appearance ─────────────────────────────────────────────────────────
        SettingsSection(title = "APPEARANCE", textColor = textColor) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        AppTheme.LIGHT    to Pair(Icons.Default.LightMode, "Light"),
                        AppTheme.DARK     to Pair(Icons.Default.DarkMode, "Dark"),
                        AppTheme.SEPIA    to Pair(Icons.Default.LocalCafe, "Sepia"),
                        AppTheme.NORD     to Pair(Icons.Default.Cloud, "Nord"),
                        AppTheme.MIDNIGHT to Pair(Icons.Default.Nightlight, "Midnight")
                    ).forEach { (theme, pair) ->
                        val (icon, label) = pair
                        val isSelected = settings.theme == theme
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) accentColor.copy(0.12f) else textColor.copy(0.06f))
                                .border(
                                    if (isSelected) 1.5.dp else 1.dp,
                                    if (isSelected) accentColor.copy(0.5f) else textColor.copy(0.1f),
                                    RoundedCornerShape(14.dp)
                                )
                                .clickable { onThemeChange(theme) }
                                .padding(vertical = 10.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = icon,
                                contentDescription = label,
                                tint = if (isSelected) accentColor else textColor.copy(0.55f),
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = label,
                                color = textColor.copy(if (isSelected) 1f else 0.55f),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                // Auto Night Mode
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(
                            if (settings.autoNightMode) Color(0xFF8B5CF6).copy(0.12f)
                            else textColor.copy(0.06f)
                        )
                        .clickable { onAutoNightModeChange(!settings.autoNightMode) }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(
                            Icons.Default.NightlightRound,
                            null,
                            tint = if (settings.autoNightMode) Color(0xFF8B5CF6) else textColor.copy(0.5f),
                            modifier = Modifier.size(18.dp)
                        )
                        Column {
                            Text("Auto Night Mode", color = textColor, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            Text("Switch to Midnight at 9 PM", color = textColor.copy(0.4f), fontSize = 10.sp)
                        }
                    }
                    Switch(
                        checked = settings.autoNightMode,
                        onCheckedChange = { onAutoNightModeChange(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF8B5CF6)
                        )
                    )
                }
            }
        }

        // ── Sharpness (Render Quality) ─────────────────────────────────────────
        SettingsSection(
            title = "SHARPNESS",
            value = qualityLabel(settings.renderQuality),
            textColor = textColor
        ) {
            Slider(
                value = settings.renderQuality.toFloat(),
                onValueChange = { onRenderQualityChange(it.toInt()) },
                valueRange = 1f..4f,
                steps = 2,
                colors = SliderDefaults.colors(
                    thumbColor = accentColor,
                    activeTrackColor = accentColor,
                    inactiveTrackColor = textColor.copy(0.2f)
                )
            )
            Text(
                text = "Enhances PDF contrast and clarity. Higher = crisper text.",
                color = textColor.copy(0.4f),
                fontSize = 11.sp,
                lineHeight = 16.sp
            )
        }

        // ── Brightness ─────────────────────────────────────────────────────────
        SettingsSection(
            title = "BRIGHTNESS",
            value = "${(settings.brightness * 100).toInt()}%",
            textColor = textColor
        ) {
            Slider(
                value = settings.brightness,
                onValueChange = onBrightnessChange,
                valueRange = 0.2f..1.0f,
                colors = SliderDefaults.colors(
                    thumbColor = accentColor,
                    activeTrackColor = accentColor,
                    inactiveTrackColor = textColor.copy(0.2f)
                )
            )
        }

        // ── Auto Reading ───────────────────────────────────────────────────────
        SettingsSection(title = "AUTO READING", textColor = textColor) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(androidx.compose.foundation.shape.CircleShape)
                                .background(
                                    if (settings.isAutoScrolling) Color(0xFF22C55E)
                                    else Color(0xFFEF4444).copy(0.6f)
                                )
                        )
                        Text("Auto Scroll", color = textColor, fontSize = 13.sp)
                    }
                    Switch(
                        checked = settings.isAutoScrolling,
                        onCheckedChange = { onAutoScrollChange(it, settings.autoScrollSpeed) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF22C55E)
                        )
                    )
                }
                if (settings.isAutoScrolling || settings.autoScrollSpeed > 0f) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Slow", color = textColor.copy(0.4f), fontSize = 10.sp)
                        Slider(
                            value = settings.autoScrollSpeed.coerceIn(0.02f, 10f),
                            onValueChange = { onAutoScrollChange(settings.isAutoScrolling, it) },
                            valueRange = 0.02f..10f,
                            modifier = Modifier.weight(1f),
                            colors = SliderDefaults.colors(
                                thumbColor = accentColor,
                                activeTrackColor = accentColor,
                                inactiveTrackColor = textColor.copy(0.2f)
                            )
                        )
                        Text("Fast", color = textColor.copy(0.4f), fontSize = 10.sp)
                    }
                }
            }
        }

        // ── Background Music ───────────────────────────────────────────────────
        SettingsSection(title = "BACKGROUND MUSIC", textColor = textColor) {
            MusicPlayerPanel(
                selectedTrackId = settings.backgroundMusic,
                volume = settings.volume,
                bgColor = bgColor,
                textColor = textColor,
                accentColor = accentColor,
                onTrackSelect = onMusicChange,
                onVolumeChange = onVolumeChange
            )
        }
    }
}

@Composable
private fun SettingsSection(
    title: String,
    value: String? = null,
    textColor: Color,
    content: @Composable () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                color = textColor.copy(alpha = 0.5f),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
            if (value != null) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(textColor.copy(0.1f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(value, color = textColor, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
        content()
    }
}

private fun qualityLabel(quality: Int) = when (quality) {
    1 -> "Standard"; 2 -> "Sharp"; 3 -> "Crystal"; else -> "Ultra"
}
