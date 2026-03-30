package com.veuros.ribi.ui.auth

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.veuros.ribi.R

@Composable
fun AuthScreen(
    onAuthSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()

    var adminEmail by remember { mutableStateOf("") }
    var adminPassword by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var logoClickCount by remember { mutableIntStateOf(0) }
    var lastClickTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) onAuthSuccess()
    }

    // Entrance animations
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(600, easing = FastOutSlowInEasing), label = "alpha"
    )
    val slideY by animateFloatAsState(
        targetValue = if (visible) 0f else 40f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "slide"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF050A18), Color(0xFF0D1B3E), Color(0xFF060B1A))
                )
            )
    ) {
        // Background accent glows
        Box(
            modifier = Modifier.size(500.dp).offset(x = (-100).dp, y = (-120).dp).blur(80.dp)
                .background(Brush.radialGradient(
                    colors = listOf(Color(0xFF3B82F6).copy(0.2f), Color.Transparent)
                ), CircleShape)
        )
        Box(
            modifier = Modifier.size(400.dp).align(Alignment.BottomEnd).offset(x = 80.dp, y = 60.dp).blur(80.dp)
                .background(Brush.radialGradient(
                    colors = listOf(Color(0xFF8B5CF6).copy(0.15f), Color.Transparent)
                ), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .systemBarsPadding()
                .padding(horizontal = 24.dp, vertical = 32.dp)
                .alpha(alpha)
                .offset(y = slideY.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(24.dp))

            // Ribi Logo
            Box(
                modifier = Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color.White.copy(0.05f))
                    .border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(24.dp))
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
                Image(
                    painter = painterResource(id = R.drawable.ic_ribi),
                    contentDescription = "Ribi",
                    modifier = Modifier.size(60.dp),
                    contentScale = ContentScale.Fit
                )
            }

            Spacer(Modifier.height(24.dp))

            Text(
                text = buildAnnotatedString {
                    append("Welcome to ")
                    withStyle(SpanStyle(
                        brush = Brush.linearGradient(
                            colors = listOf(Color(0xFF60A5FA), Color(0xFF818CF8), Color(0xFFA78BFA))
                        ),
                        fontWeight = FontWeight.ExtraBold
                    )) { append("Ribi") }
                },
                style = TextStyle(color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            )

            Spacer(Modifier.height(6.dp))

            Text(
                text = "Your next page is waiting.",
                color = Color(0xFF94A3B8),
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(32.dp))

            // Error Banner
            AnimatedVisibility(
                visible = uiState.error != null,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Box(modifier = Modifier.padding(bottom = 16.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFEF4444).copy(0.1f))
                            .border(1.dp, Color(0xFFEF4444).copy(0.3f), RoundedCornerShape(16.dp))
                            .padding(14.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            Icons.Default.Error, null,
                            tint = Color(0xFFF87171),
                            modifier = Modifier.size(18.dp).padding(top = 1.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = errorTitle(uiState.errorCode),
                                color = Color(0xFFF87171),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = uiState.error ?: "",
                                color = Color(0xFFF87171).copy(0.85f),
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                        IconButton(onClick = viewModel::clearError, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.Close, null, tint = Color(0xFFF87171).copy(0.6f), modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }

            // Admin Panel
            AnimatedVisibility(
                visible = uiState.adminMode,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF7C3AED).copy(0.07f))
                        .border(1.dp, Color(0xFF7C3AED).copy(0.25f), RoundedCornerShape(20.dp))
                        .padding(16.dp)
                        .padding(bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.AdminPanelSettings, null,
                            tint = Color(0xFFA78BFA), modifier = Modifier.size(14.dp))
                        Text("ADMIN ACCESS", color = Color(0xFFA78BFA),
                            fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        Spacer(Modifier.weight(1f))
                        IconButton(onClick = viewModel::toggleAdminMode, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Default.Close, null, tint = Color(0xFFA78BFA).copy(0.5f), modifier = Modifier.size(14.dp))
                        }
                    }

                    OutlinedTextField(
                        value = adminEmail,
                        onValueChange = { adminEmail = it },
                        label = { Text("Admin email", fontSize = 12.sp) },
                        leadingIcon = { Icon(Icons.Default.Email, null, modifier = Modifier.size(16.dp)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                        singleLine = true, colors = adminTextFieldColors(),
                        shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = adminPassword,
                        onValueChange = { adminPassword = it },
                        label = { Text("Admin password", fontSize = 12.sp) },
                        leadingIcon = { Icon(Icons.Default.Lock, null, modifier = Modifier.size(16.dp)) },
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    null, modifier = Modifier.size(16.dp))
                            }
                        },
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            focusManager.clearFocus()
                            viewModel.signInAsAdmin(adminEmail, adminPassword)
                        }),
                        singleLine = true, colors = adminTextFieldColors(),
                        shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = { focusManager.clearFocus(); viewModel.signInAsAdmin(adminEmail, adminPassword) },
                        enabled = !uiState.isLoading && adminEmail.isNotBlank() && adminPassword.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.LockOpen, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Sign In as Admin", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // Google Sign-In Button
            Button(
                onClick = { viewModel.signInWithGoogle(context) },
                enabled = !uiState.isLoading,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White,
                    contentColor = Color(0xFF1E293B),
                    disabledContainerColor = Color.White.copy(0.5f)
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp, pressedElevation = 0.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(Modifier.size(20.dp), color = Color(0xFF3B82F6), strokeWidth = 2.5.dp)
                } else {
                    // Google G
                    Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                        Text("G", color = Color(0xFF4285F4), fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    }
                    Spacer(Modifier.width(10.dp))
                    Text("Continue with Google", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Color(0xFF1E293B))
                }
            }

            Spacer(Modifier.height(12.dp))

            // Bypass button — Continue without account
            TextButton(
                onClick = { viewModel.continueAsGuest() },
                enabled = !uiState.isLoading,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(18.dp)
            ) {
                Icon(
                    Icons.Default.PersonOutline, null,
                    tint = Color(0xFF64748B),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Continue without account",
                    color = Color(0xFF64748B),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            // Guest mode notice
            AnimatedVisibility(visible = !uiState.adminMode && !uiState.isLoading) {
                Text(
                    text = "Guest mode — no cloud sync. Sign in anytime from Settings.",
                    color = Color(0xFF475569),
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            Spacer(Modifier.weight(1f))
            Spacer(Modifier.height(24.dp))

            // Footer
            HorizontalDivider(color = Color.White.copy(0.06f))
            Spacer(Modifier.height(16.dp))

            // Veuros logo in footer
            Image(
                painter = painterResource(id = R.drawable.logo_veuros),
                contentDescription = "Veuros",
                modifier = Modifier.height(20.dp),
                contentScale = ContentScale.Fit
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = "© 2025 Veuros. All rights reserved.",
                color = Color(0xFF334155),
                fontSize = 11.sp
            )
            Text(
                text = "Founded by Veer Agnihotri",
                style = TextStyle(
                    fontSize = 11.sp, fontWeight = FontWeight.Medium,
                    brush = Brush.linearGradient(
                        colors = listOf(Color(0xFFFDE68A), Color(0xFFF59E0B), Color(0xFFF97316))
                    )
                ),
                modifier = Modifier.padding(top = 3.dp)
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}

private fun errorTitle(code: AuthError): String = when (code) {
    AuthError.NETWORK         -> "Connection Problem"
    AuthError.INVALID_CREDENTIALS -> "Invalid Credentials"
    AuthError.TOO_MANY_ATTEMPTS   -> "Slow Down"
    AuthError.NO_GOOGLE_ACCOUNT   -> "No Google Account"
    AuthError.CANCELLED       -> ""
    else                      -> "Sign-in Error"
}

@Composable
private fun adminTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor    = Color(0xFF7C3AED),
    unfocusedBorderColor  = Color.White.copy(0.1f),
    focusedTextColor      = Color.White,
    unfocusedTextColor    = Color.White,
    cursorColor           = Color(0xFF7C3AED),
    focusedLabelColor     = Color(0xFF7C3AED),
    unfocusedLabelColor   = Color.White.copy(0.4f),
    focusedLeadingIconColor    = Color.White.copy(0.5f),
    unfocusedLeadingIconColor  = Color.White.copy(0.3f),
    focusedTrailingIconColor   = Color.White.copy(0.5f),
    unfocusedTrailingIconColor = Color.White.copy(0.3f),
    focusedContainerColor      = Color.White.copy(0.04f),
    unfocusedContainerColor    = Color.White.copy(0.03f)
)
