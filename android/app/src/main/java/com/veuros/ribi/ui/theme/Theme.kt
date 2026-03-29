package com.veuros.ribi.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val RibiColorScheme = darkColorScheme(
    primary          = RibiBlue,
    onPrimary        = Color.White,
    primaryContainer = Color(0xFF1D4ED8),
    secondary        = RibiPurple,
    background       = SplashBg,
    surface          = Color(0xFF0A0F1E),
    onBackground     = Color.White,
    onSurface        = Color.White,
    error            = Color(0xFFEF4444),
    onError          = Color.White,
)

@Composable
fun RibiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = RibiColorScheme,
        typography  = RibiTypography,
        content     = content
    )
}
