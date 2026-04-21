package com.veuros.ribi.ui.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.veuros.ribi.ui.theme.RibiOrange

@Composable
fun AuthScreen(
    onAuthSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current

    var adminEmail by remember { mutableStateOf("") }
    var adminPassword by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var logoClickCount by remember { mutableIntStateOf(0) }
    var lastClickTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) onAuthSuccess()
    }

    // Entrance animation
    val cardAlpha by animateFloatAsState(
        targetValue = 1f, animationSpec = tween(700, easing = FastOutSlowInEasing), label = "card"
    )
    val cardOffsetY by animateFloatAsState(
        targetValue = 0f, animationSpec = spring(Spring.DampingRatioMediumBouncy), label = "cardY"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(Color(0xFF0A0F1E), Color(0xFF0D1B3E), Color(0xFF0A0F1E)),
                    start = androidx.compose.ui.geometry.Offset(0f, 0f),
                    end = androidx.compose.ui.geometry.Offset(1000f, 1000f)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Background glows
        Box(
            modifier = Modifier
                .size(380.dp)
                .offset(x = (-60).dp, y = (-80).dp)
                .blur(60.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0xFF3B82F6).copy(0.25f), Color.Transparent)
                    ),
                    shape = CircleShape
                )
        )
        Box(
            modifier = Modifier
                .size(320.dp)
                .offset(x = 80.dp, y = 100.dp)
                .blur(60.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0xFF8B5CF6).copy(0.18f), Color.Transparent)
                    ),
                    shape = CircleShape
                )
        )

        // Auth Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .alpha(cardAlpha)
                .offset(y = cardOffsetY.dp),
            shape = RoundedCornerShape(32.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF0A0F23).copy(alpha = 0.82f)
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 32.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Logo (tappable for admin access)
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF3B82F6).copy(0.12f))
                        .border(1.dp, Color(0xFF3B82F6).copy(0.25f), RoundedCornerShape(20.dp))
                        .clickable {
                            val now = System.currentTimeMillis()
                            if (now - lastClickTime > 1500L) logoClickCount = 0
                            lastClickTime = now
                            logoClickCount++
                            if (logoClickCount >= 5) {
                                logoClickCount = 0
                                viewModel.toggleAdminMode()
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.MenuBook,
                        contentDescription = "Ribi Logo",
                        tint = Color(0xFF60A5FA),
                        modifier = Modifier.size(36.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Title
                Text(
                    text = buildAnnotatedString {
                        append("Welcome to ")
                        withStyle(
                            SpanStyle(
                                brush = Brush.linearGradient(
                                    colors = listOf(
                                        Color(0xFFF97316), Color(0xFFEF4444), Color(0xFFF59E0B)
                                    )
                                ),
                                fontWeight = FontWeight.Bold
                            )
                        ) { append("Ribi") }
                    },
                    style = TextStyle(
                        color = Color.White,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold
                    )
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Your next page is waiting.",
                    style = TextStyle(
                        color = Color(0xFF94A3B8).copy(alpha = 0.9f),
                        fontSize = 14.sp
                    )
                )

                Spacer(modifier = Modifier.height(28.dp))

                // Error banner
                AnimatedVisibility(visible = uiState.error != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFFEF4444).copy(0.12f))
                            .border(1.dp, Color(0xFFEF4444).copy(0.25f), RoundedCornerShape(14.dp))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Warning, null, tint = Color(0xFFF87171), modifier = Modifier.size(16.dp))
                        Text(
                            text = uiState.error ?: "",
                            color = Color(0xFFF87171),
                            fontSize = 13.sp
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }

                // Admin panel
                AnimatedVisibility(
                    visible = uiState.adminMode,
                    enter = expandVertically() + fadeIn(),
                    exit = shrinkVertically() + fadeOut()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF8B5CF6).copy(0.08f))
                            .border(1.dp, Color(0xFF8B5CF6).copy(0.22f), RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.Lock, null, tint = Color(0xFFA78BFA), modifier = Modifier.size(12.dp))
                            Text("ADMIN ACCESS", color = Color(0xFFA78BFA),
                                fontSize = 10.sp, fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp)
                        }

                        OutlinedTextField(
                            value = adminEmail,
                            onValueChange = { adminEmail = it },
                            label = { Text("Admin email", fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.Email, null, modifier = Modifier.size(16.dp)) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                            singleLine = true,
                            colors = authTextFieldColors(),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = adminPassword,
                            onValueChange = { adminPassword = it },
                            label = { Text("Admin password", fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.Lock, null, modifier = Modifier.size(16.dp)) },
                            trailingIcon = {
                                IconButton(onClick = { showPassword = !showPassword }) {
                                    Icon(
                                        if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                        null, modifier = Modifier.size(16.dp)
                                    )
                                }
                            },
                            visualTransformation = if (showPassword) VisualTransformation.None
                                                   else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = {
                                focusManager.clearFocus()
                                viewModel.signInAsAdmin(adminEmail, adminPassword)
                            }),
                            singleLine = true,
                            colors = authTextFieldColors(),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            onClick = {
                                focusManager.clearFocus()
                                viewModel.signInAsAdmin(adminEmail, adminPassword)
                            },
                            enabled = !uiState.isLoading && adminEmail.isNotBlank() && adminPassword.isNotBlank(),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            } else {
                                Text("Sign In as Admin", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Google sign-in button
                Button(
                    onClick = { viewModel.signInWithGoogle(context) },
                    enabled = !uiState.isLoading,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.97f),
                        contentColor = Color(0xFF1E293B),
                        disabledContainerColor = Color.White.copy(alpha = 0.5f)
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            Modifier.size(20.dp),
                            color = Color(0xFF3B82F6),
                            strokeWidth = 2.5.dp
                        )
                    } else {
                        GoogleLogo()
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Continue with Google",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = Color(0xFF1E293B)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Footer
                Divider(color = Color.White.copy(alpha = 0.06f))
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "© 2024 Veuros. All rights reserved.",
                    color = Color(0xFF64748B).copy(alpha = 0.8f),
                    fontSize = 11.sp
                )
                Text(
                    text = "Founded by Veer Agnihotri",
                    style = TextStyle(
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        brush = Brush.linearGradient(
                            colors = listOf(Color(0xFFFDE68A), Color(0xFFF59E0B), Color(0xFFF97316))
                        )
                    ),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun authTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor   = Color(0xFF7C3AED),
    unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
    focusedTextColor     = Color.White,
    unfocusedTextColor   = Color.White,
    cursorColor          = Color(0xFF7C3AED),
    focusedLabelColor    = Color(0xFF7C3AED),
    unfocusedLabelColor  = Color.White.copy(0.4f),
    focusedLeadingIconColor   = Color.White.copy(0.5f),
    unfocusedLeadingIconColor = Color.White.copy(0.35f),
    focusedTrailingIconColor  = Color.White.copy(0.5f),
    unfocusedTrailingIconColor = Color.White.copy(0.35f),
    focusedContainerColor     = Color.White.copy(0.05f),
    unfocusedContainerColor   = Color.White.copy(0.04f)
)

@Composable
private fun GoogleLogo() {
    // Simple Google G using colored boxes
    Box(modifier = Modifier.size(20.dp), contentAlignment = Alignment.Center) {
        Text(text = "G", color = Color(0xFF4285F4), fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}
