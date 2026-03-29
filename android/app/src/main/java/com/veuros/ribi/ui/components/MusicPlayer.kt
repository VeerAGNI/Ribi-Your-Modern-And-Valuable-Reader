package com.veuros.ribi.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.veuros.ribi.data.model.BackgroundTracks

@Composable
fun MusicPlayerPanel(
    selectedTrackId: String?,
    volume: Float,
    bgColor: Color,
    textColor: Color,
    accentColor: Color,
    onTrackSelect: (String?) -> Unit,
    onVolumeChange: (Float) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "BACKGROUND MUSIC",
            color = textColor.copy(alpha = 0.5f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp
        )

        // Track buttons
        BackgroundTracks.tracks.forEach { track ->
            val isSelected = track.id == selectedTrackId
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        if (isSelected) accentColor.copy(alpha = 0.15f)
                        else textColor.copy(alpha = 0.06f)
                    )
                    .border(
                        width = if (isSelected) 1.5.dp else 1.dp,
                        color = if (isSelected) accentColor.copy(0.5f) else textColor.copy(0.12f),
                        shape = RoundedCornerShape(14.dp)
                    )
                    .clickable { onTrackSelect(if (isSelected) null else track.id) }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Track icon
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) accentColor.copy(0.2f) else textColor.copy(0.08f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = when (track.id) {
                                "gamma" -> Icons.Default.Waves
                                "rain"  -> Icons.Default.WaterDrop
                                else    -> Icons.Default.Water
                            },
                            contentDescription = null,
                            tint = if (isSelected) accentColor else textColor.copy(0.5f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Text(
                        text = track.name,
                        color = if (isSelected) accentColor else textColor.copy(0.8f),
                        fontSize = 14.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                    )
                }

                if (isSelected) {
                    // Playing indicator
                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        repeat(3) { i ->
                            Box(
                                modifier = Modifier
                                    .width(3.dp)
                                    .height((8 + i * 4).dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(accentColor)
                            )
                        }
                    }
                }
            }
        }

        // Volume slider
        AnimatedVisibility(visible = selectedTrackId != null) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.VolumeUp, null, tint = textColor.copy(0.5f),
                            modifier = Modifier.size(14.dp))
                        Text("Volume", color = textColor.copy(0.5f), fontSize = 11.sp)
                    }
                    Text("${(volume * 100).toInt()}%", color = textColor.copy(0.4f),
                        fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
                Slider(
                    value = volume,
                    onValueChange = onVolumeChange,
                    colors = SliderDefaults.colors(
                        thumbColor = accentColor,
                        activeTrackColor = accentColor,
                        inactiveTrackColor = textColor.copy(0.2f)
                    )
                )
            }
        }
    }
}
