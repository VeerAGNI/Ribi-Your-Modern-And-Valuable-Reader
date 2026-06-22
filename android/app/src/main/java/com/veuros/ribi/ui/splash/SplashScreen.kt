package com.veuros.ribi.ui.splash

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.veuros.ribi.R
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onComplete: () -> Unit) {
    var phase by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        delay(350)
        phase = 1   // content fades in
        delay(3900)
        phase = 2   // fade out
        delay(950)
        onComplete()
    }

    // Fade out whole screen
    val screenAlpha by animateFloatAsState(
        targetValue = if (phase == 2) 0f else 1f,
        animationSpec = tween(950, easing = FastOutSlowInEasing),
        label = "screenAlpha"
    )

    // Ribi logo entrance
    val ribiAlpha by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0f,
        animationSpec = tween(900, easing = FastOutSlowInEasing),
        label = "ribiAlpha"
    )
    val ribiScale by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0.78f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "ribiScale"
    )
    val ribiOffsetY by animateFloatAsState(
        targetValue = if (phase >= 1) 0f else 28f,
        animationSpec = tween(900, easing = FastOutSlowInEasing),
        label = "ribiOffsetY"
    )

    // Veuros logo entrance (slight delay)
    val veurosAlpha by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0f,
        animationSpec = tween(900, delayMillis = 200, easing = FastOutSlowInEasing),
        label = "veurosAlpha"
    )
    val veurosScale by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0.85f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "veurosScale"
    )

    // Separator line
    val lineScale by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0f,
        animationSpec = tween(800, delayMillis = 350, easing = FastOutSlowInEasing),
        label = "lineScale"
    )

    // Pulsing glow on Ribi logo
    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowAlpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(screenAlpha),
        contentAlignment = Alignment.Center
    ) {
        // Real splash background image
        Image(
            painter = painterResource(id = R.drawable.splash_background),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // Subtle dark overlay for readability
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0x62080418))
        )

        // Content
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 32.dp)
        ) {
            // Ribi logo (book icon) with spring entrance
            Box(
                modifier = Modifier
                    .alpha(ribiAlpha * glowAlpha.coerceIn(0.7f, 1f))
                    .scale(ribiScale)
                    .offset(y = ribiOffsetY.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ribi_logo),
                    contentDescription = "Ribi",
                    modifier = Modifier.size(110.dp),
                    contentScale = ContentScale.Fit
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Veuros logo with spring entrance
            Box(
                modifier = Modifier
                    .alpha(veurosAlpha)
                    .scale(veurosScale)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.veuros_logo),
                    contentDescription = "Veuros",
                    modifier = Modifier.width(220.dp),
                    contentScale = ContentScale.Fit
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Separator line
            Box(
                modifier = Modifier
                    .width(220.dp * lineScale)
                    .height(1.dp)
                    .alpha(lineScale)
                    .background(
                        brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color(0xFFC89FFF).copy(alpha = 0.85f),
                                Color(0xFF9361FD),
                                Color(0xFFC89FFF).copy(alpha = 0.85f),
                                Color.Transparent
                            )
                        )
                    )
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Loading dots
            if (phase >= 1) {
                LoadingDots()
            }
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
                targetValue = 1.25f,
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
                        color = Color(0xFFC89FFF).copy(alpha = 0.85f),
                        shape = androidx.compose.foundation.shape.CircleShape
                    )
            )
        }
    }
}
