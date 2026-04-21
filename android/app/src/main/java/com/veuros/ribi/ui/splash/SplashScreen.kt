package com.veuros.ribi.ui.splash

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Text
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val SplashDark = Color(0xFF00040F)
private val GlowBlue   = Color(0xFF2563EB)
private val GlowTeal   = Color(0xFF38BDF8)
private val GlowPurple = Color(0xFF633CDC)

@Composable
fun SplashScreen(onComplete: () -> Unit) {
    var phase by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        delay(400)
        phase = 1   // fade in text
        delay(3800)
        phase = 2   // fade out
        delay(900)
        onComplete()
    }

    // Animated values
    val textAlpha by animateFloatAsState(
        targetValue = when (phase) { 1 -> 1f; 2 -> 0f; else -> 0f },
        animationSpec = tween(900, easing = FastOutSlowInEasing), label = "textAlpha"
    )
    val textScale by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0.88f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioLowBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "textScale"
    )
    val bgAlpha by animateFloatAsState(
        targetValue = if (phase == 2) 0f else 1f,
        animationSpec = tween(900), label = "bgAlpha"
    )

    // Pulsing glow orbs
    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowScale by infiniteTransition.animateFloat(
        initialValue = 1f, targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "glowScale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(bgAlpha)
            .background(SplashDark),
        contentAlignment = Alignment.Center
    ) {
        // Blue glow orb
        Box(
            modifier = Modifier
                .size(400.dp)
                .scale(glowScale)
                .blur(80.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(GlowBlue.copy(alpha = 0.22f), Color.Transparent)
                    ),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        )

        // Teal glow
        Box(
            modifier = Modifier
                .size(300.dp)
                .offset(x = (-20).dp, y = (-40).dp)
                .scale(1f / glowScale)
                .blur(60.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(GlowTeal.copy(alpha = 0.18f), Color.Transparent)
                    ),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        )

        // Purple glow
        Box(
            modifier = Modifier
                .size(250.dp)
                .offset(x = 30.dp, y = 40.dp)
                .scale(glowScale * 0.9f)
                .blur(50.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(GlowPurple.copy(alpha = 0.14f), Color.Transparent)
                    ),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        )

        // Main content
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .scale(textScale)
                .alpha(textAlpha)
        ) {
            // VEUROS title with gradient
            Text(
                text = "VEUROS",
                style = TextStyle(
                    fontWeight = FontWeight.Black,
                    fontSize = 72.sp,
                    letterSpacing = 8.sp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.White,
                            Color(0xFF93C5FD),
                            Color(0xFF3B82F6),
                            Color(0xFF1D4ED8)
                        )
                    )
                )
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Separator line
            Box(
                modifier = Modifier
                    .width(200.dp)
                    .height(1.dp)
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(
                                Color.Transparent,
                                GlowTeal.copy(alpha = 0.8f),
                                Color(0xFF3B82F6),
                                GlowTeal.copy(alpha = 0.8f),
                                Color.Transparent
                            )
                        )
                    )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Tagline
            Text(
                text = "REDEFINING TECHNOLOGY",
                style = TextStyle(
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                    letterSpacing = 4.sp,
                    color = Color(0xFF93C5FD).copy(alpha = 0.85f)
                )
            )

            Spacer(modifier = Modifier.height(40.dp))

            // Loading dots
            LoadingDots()
        }
    }
}

@Composable
private fun LoadingDots() {
    val infiniteTransition = rememberInfiniteTransition(label = "dots")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(3) { index ->
            val alpha by infiniteTransition.animateFloat(
                initialValue = 0.2f,
                targetValue = 1.0f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, delayMillis = index * 200),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "dot$index"
            )
            val scale by infiniteTransition.animateFloat(
                initialValue = 0.8f,
                targetValue = 1.2f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, delayMillis = index * 200),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "dotScale$index"
            )
            Box(
                modifier = Modifier
                    .size(5.dp)
                    .scale(scale)
                    .alpha(alpha)
                    .background(
                        color = Color(0xFF38BDF8).copy(alpha = 0.7f),
                        shape = androidx.compose.foundation.shape.CircleShape
                    )
            )
        }
    }
}
