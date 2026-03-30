package com.veuros.ribi.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.veuros.ribi.R
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onReady: () -> Unit) {
    var phase by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        delay(200);  phase = 1
        delay(1100); phase = 2
        delay(900);  phase = 3
        delay(450);  onReady()
    }

    val veurosAlpha by animateFloatAsState(
        targetValue = if (phase in 1..2) 1f else 0f,
        animationSpec = tween(650, easing = FastOutSlowInEasing), label = "vA"
    )
    val veurosScale by animateFloatAsState(
        targetValue = if (phase >= 1) 1f else 0.80f,
        animationSpec = spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMediumLow), label = "vS"
    )
    val ribiAlpha by animateFloatAsState(
        targetValue = if (phase == 2) 1f else 0f,
        animationSpec = tween(550, easing = FastOutSlowInEasing), label = "rA"
    )
    val ribiSlide by animateFloatAsState(
        targetValue = if (phase == 2) 0f else 12f,
        animationSpec = tween(550, easing = FastOutSlowInEasing), label = "rS"
    )

    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.12f, targetValue = 0.30f,
        animationSpec = infiniteRepeatable(tween(2000), RepeatMode.Reverse), label = "gA"
    )

    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF050912)),
        contentAlignment = Alignment.Center
    ) {
        // Pulsing glow orbs
        Box(
            modifier = Modifier.size(560.dp).offset(x = (-90).dp, y = (-110).dp).blur(100.dp)
                .background(
                    Brush.radialGradient(listOf(Color(0xFF3B82F6).copy(glowAlpha), Color.Transparent)),
                    CircleShape
                )
        )
        Box(
            modifier = Modifier.size(420.dp).offset(x = 110.dp, y = 130.dp).blur(100.dp)
                .background(
                    Brush.radialGradient(listOf(Color(0xFF8B5CF6).copy(glowAlpha * 0.6f), Color.Transparent)),
                    CircleShape
                )
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // VEUROS company logo
            Image(
                painter = painterResource(R.drawable.logo_veuros),
                contentDescription = "Veuros",
                modifier = Modifier
                    .height(70.dp)
                    .alpha(veurosAlpha)
                    .scale(veurosScale),
                contentScale = ContentScale.Fit
            )

            Spacer(Modifier.height(36.dp))

            // Ribi product logo
            Image(
                painter = painterResource(R.drawable.logo_ribi),
                contentDescription = "Ribi",
                modifier = Modifier
                    .height(42.dp)
                    .alpha(ribiAlpha)
                    .offset(y = ribiSlide.dp),
                contentScale = ContentScale.Fit
            )
        }

        // Bottom tagline
        Text(
            text = "PRESENTS",
            style = TextStyle(
                fontSize = 10.sp, fontWeight = FontWeight.Bold,
                color = Color.White.copy(veurosAlpha * 0.25f),
                letterSpacing = 5.sp
            ),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 36.dp)
        )
    }
}
