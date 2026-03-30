package com.veuros.ribi.ui.reader

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.veuros.ribi.data.model.*
import com.veuros.ribi.service.MusicService
import com.veuros.ribi.ui.components.AchievementToast
import com.veuros.ribi.ui.settings.SettingsPanel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderScreen(
    bookId: String,
    onBack: () -> Unit,
    viewModel: ReaderViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val renderedPage by viewModel.renderedPage.collectAsState()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Music service binding
    var musicService by remember { mutableStateOf<MusicService?>(null) }
    val serviceConnection = remember {
        object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                musicService = (binder as? MusicService.MusicBinder)?.getService()
            }
            override fun onServiceDisconnected(name: ComponentName?) { musicService = null }
        }
    }

    DisposableEffect(Unit) {
        viewModel.loadBook(bookId)
        try {
            val intent = Intent(context, MusicService::class.java)
            context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        } catch (_: Exception) {}
        onDispose {
            try { context.unbindService(serviceConnection) } catch (_: Exception) {}
        }
    }

    // Sync music
    LaunchedEffect(uiState.settings.backgroundMusic, uiState.settings.volume) {
        val trackId = uiState.settings.backgroundMusic
        val vol = uiState.settings.volume
        musicService?.playTrack(trackId, vol) ?: run {
            if (trackId != null) {
                val intent = Intent(context, MusicService::class.java)
                context.startService(intent)
            }
        }
    }

    val settings = uiState.settings
    val theme = AppThemes.get(settings.theme)
    val bgColor     = Color(theme.bg)
    val textColor   = Color(theme.text)
    val accentColor = Color(theme.accent)

    // Compute PDF color filter from theme — memoized per theme change
    val pdfColorFilter = remember(settings.theme) {
        val matrix = AppThemes.get(settings.theme).pdfColorMatrix
        if (matrix != null) ColorFilter.colorMatrix(ColorMatrix(matrix)) else null
    }

    var showSettings by remember { mutableStateOf(false) }
    var showPageInput by remember { mutableStateOf(false) }
    var pageInputText by remember { mutableStateOf("") }
    val settingsSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor)
    ) {
        when {
            uiState.isLoading -> LoadingView(accentColor, textColor)
            uiState.loadError != null -> ErrorView(uiState.loadError!!, textColor, accentColor, onBack)
            else -> {
                // PDF content area
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectTapGestures(onTap = { viewModel.showHud() })
                        }
                ) {
                    if (settings.viewMode == ViewMode.PAGE) {
                        PageModeView(
                            renderedPage = renderedPage,
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            brightness = settings.brightness,
                            zoomScale = uiState.zoomScale,
                            pdfColorFilter = pdfColorFilter,
                            bgColor = bgColor,
                            onSwipeLeft = { viewModel.nextPage() },
                            onSwipeRight = { viewModel.previousPage() }
                        )
                    } else {
                        ContinuousScrollView(
                            viewModel = viewModel,
                            uiState = uiState,
                            bgColor = bgColor,
                            pdfColorFilter = pdfColorFilter,
                            onPageVisible = { viewModel.goToPage(it) }
                        )
                    }

                    // ── Top HUD ──
                    AnimatedVisibility(
                        visible = uiState.isHudVisible,
                        enter = fadeIn(tween(200)) + slideInVertically(tween(200)) { -it },
                        exit  = fadeOut(tween(200)) + slideOutVertically(tween(200)) { -it },
                        modifier = Modifier.align(Alignment.TopCenter)
                    ) {
                        ReaderTopBar(
                            title = uiState.book?.title ?: "",
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            isBookmarked = uiState.isBookmarked,
                            accentColor = accentColor,
                            onBack = onBack,
                            onBookmark = { viewModel.toggleBookmark() },
                            onToc = { viewModel.toggleToc() },
                            onSettings = { showSettings = true }
                        )
                    }

                    // ── Bottom HUD ──
                    AnimatedVisibility(
                        visible = uiState.isHudVisible,
                        enter = fadeIn(tween(200)) + slideInVertically(tween(200)) { it },
                        exit  = fadeOut(tween(200)) + slideOutVertically(tween(200)) { it },
                        modifier = Modifier.align(Alignment.BottomCenter)
                    ) {
                        ReaderBottomBar(
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            accentColor = accentColor,
                            onPageChange = { viewModel.goToPage(it) },
                            onZoomIn = { viewModel.zoomIn() },
                            onZoomOut = { viewModel.zoomOut() },
                            onResetZoom = { viewModel.resetZoom() },
                            onPageInputTap = {
                                pageInputText = uiState.currentPage.toString()
                                showPageInput = true
                            }
                        )
                    }

                    // ── TTS Bar ──
                    AnimatedVisibility(
                        visible = settings.ttsEnabled,
                        enter = fadeIn() + slideInVertically { it / 2 },
                        exit  = fadeOut() + slideOutVertically { it / 2 },
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 80.dp)
                    ) {
                        TtsBar(
                            isSpeaking = uiState.isTtsSpeaking,
                            voice = settings.ttsVoice,
                            error = uiState.ttsError,
                            accentColor = accentColor,
                            onPlay = { viewModel.speakCurrentPage() },
                            onStop = { viewModel.stopTts() },
                            onDismissError = { viewModel.dismissTtsError() }
                        )
                    }

                    // ── TOC Panel ──
                    AnimatedVisibility(
                        visible = uiState.showToc,
                        enter = slideInHorizontally(tween(300)) { it },
                        exit  = slideOutHorizontally(tween(250)) { it },
                        modifier = Modifier.align(Alignment.CenterEnd)
                    ) {
                        TocPanel(
                            toc = uiState.toc,
                            bgColor = bgColor, textColor = textColor, accentColor = accentColor,
                            onClose = { viewModel.toggleToc() },
                            onItemClick = { page -> viewModel.goToPage(page); viewModel.toggleToc() }
                        )
                    }
                }
            }
        }

        // Achievement toast
        Box(modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 8.dp)) {
            AchievementToast(achievement = uiState.newAchievement, onDismiss = viewModel::dismissAchievement)
        }
    }

    // Settings bottom sheet
    if (showSettings) {
        ModalBottomSheet(
            onDismissRequest = { showSettings = false },
            sheetState = settingsSheetState,
            containerColor = bgColor
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding()
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Reading Settings", color = textColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    IconButton(onClick = { showSettings = false }) {
                        Icon(Icons.Default.Close, null, tint = textColor.copy(0.5f))
                    }
                }
                SettingsPanel(
                    settings = settings,
                    bgColor = bgColor, textColor = textColor, accentColor = accentColor,
                    onThemeChange = viewModel::updateTheme,
                    onViewModeChange = viewModel::updateViewMode,
                    onBrightnessChange = viewModel::updateBrightness,
                    onRenderQualityChange = viewModel::updateRenderQuality,
                    onAutoNightModeChange = viewModel::updateAutoNightMode,
                    onAutoScrollChange = viewModel::updateAutoScroll,
                    onMusicChange = viewModel::updateMusic,
                    onVolumeChange = viewModel::updateVolume,
                    onTtsEnabledChange = viewModel::updateTtsEnabled,
                    onTtsVoiceChange = viewModel::updateTtsVoice,
                    onTtsSpeedChange = viewModel::updateTtsSpeed
                )
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    // Page input dialog
    if (showPageInput) {
        AlertDialog(
            onDismissRequest = { showPageInput = false },
            containerColor = bgColor, titleContentColor = textColor,
            title = { Text("Go to Page") },
            text = {
                OutlinedTextField(
                    value = pageInputText,
                    onValueChange = { pageInputText = it.filter { c -> c.isDigit() } },
                    label = { Text("Page (1–${uiState.totalPages})") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accentColor, unfocusedBorderColor = textColor.copy(0.3f),
                        focusedTextColor = textColor, unfocusedTextColor = textColor,
                        cursorColor = accentColor, focusedLabelColor = accentColor,
                        unfocusedLabelColor = textColor.copy(0.5f)
                    )
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    pageInputText.toIntOrNull()?.let { viewModel.goToPage(it) }
                    showPageInput = false
                }) { Text("Go", color = accentColor, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showPageInput = false }) {
                    Text("Cancel", color = textColor.copy(0.6f))
                }
            }
        )
    }
}

// ─── Loading ──────────────────────────────────────────────────────────────────

@Composable
private fun LoadingView(accentColor: Color, textColor: Color) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = accentColor, strokeWidth = 3.dp)
            Text("Opening book…", color = textColor.copy(0.6f), fontSize = 14.sp)
        }
    }
}

@Composable
private fun ErrorView(error: String, textColor: Color, accentColor: Color, onBack: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(Icons.Default.ErrorOutline, null, tint = Color(0xFFEF4444), modifier = Modifier.size(52.dp))
            Text("Couldn't open book", color = textColor, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text(error, color = textColor.copy(0.6f), fontSize = 13.sp)
            Button(onClick = onBack, colors = ButtonDefaults.buttonColors(containerColor = accentColor)) {
                Text("Go Back")
            }
        }
    }
}

// ─── Page Mode ────────────────────────────────────────────────────────────────

@Composable
private fun PageModeView(
    renderedPage: android.graphics.Bitmap?,
    currentPage: Int,
    totalPages: Int,
    brightness: Float,
    zoomScale: Float,
    pdfColorFilter: ColorFilter?,
    bgColor: Color,
    onSwipeLeft: () -> Unit,
    onSwipeRight: () -> Unit
) {
    var dragX by remember { mutableFloatStateOf(0f) }
    val animDragX by animateFloatAsState(
        targetValue = dragX,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "drag"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .graphicsLayer { alpha = brightness }
            .pointerInput(currentPage) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        when {
                            dragX < -80f -> { onSwipeLeft();  dragX = 0f }
                            dragX >  80f -> { onSwipeRight(); dragX = 0f }
                            else         -> { dragX = 0f }
                        }
                    }
                ) { _, delta -> dragX = (dragX + delta).coerceIn(-300f, 300f) }
            }
            .graphicsLayer { translationX = animDragX },
        contentAlignment = Alignment.Center
    ) {
        AnimatedContent(
            targetState = renderedPage,
            transitionSpec = {
                fadeIn(tween(180)) togetherWith fadeOut(tween(120))
            },
            label = "page_anim"
        ) { bitmap ->
            if (bitmap != null && !bitmap.isRecycled) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "Page $currentPage",
                    contentScale = ContentScale.Fit,
                    colorFilter = pdfColorFilter,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer { scaleX = zoomScale; scaleY = zoomScale }
                )
            } else {
                Box(Modifier.fillMaxSize().background(bgColor), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFF3B82F6))
                }
            }
        }
    }
}

// ─── Continuous Scroll ────────────────────────────────────────────────────────

@Composable
private fun ContinuousScrollView(
    viewModel: ReaderViewModel,
    uiState: ReaderUiState,
    bgColor: Color,
    pdfColorFilter: ColorFilter?,
    onPageVisible: (Int) -> Unit
) {
    val lazyListState = rememberLazyListState()

    // Auto-scroll
    LaunchedEffect(uiState.settings.isAutoScrolling, uiState.settings.autoScrollSpeed) {
        while (uiState.settings.isAutoScrolling && uiState.settings.autoScrollSpeed > 0) {
            lazyListState.scrollBy(uiState.settings.autoScrollSpeed * 0.6f)
            delay(16L)
        }
    }

    LaunchedEffect(lazyListState.firstVisibleItemIndex) {
        onPageVisible(lazyListState.firstVisibleItemIndex + 1)
    }

    val renderedPage by viewModel.renderedPage.collectAsState()

    LazyColumn(
        state = lazyListState,
        modifier = Modifier.fillMaxSize().graphicsLayer { alpha = uiState.settings.brightness },
        verticalArrangement = Arrangement.spacedBy(2.dp),
        contentPadding = PaddingValues(vertical = 56.dp)
    ) {
        items(uiState.totalPages, key = { it }) { index ->
            if (renderedPage != null && !renderedPage!!.isRecycled) {
                Image(
                    bitmap = renderedPage!!.asImageBitmap(),
                    contentDescription = "Page ${index + 1}",
                    contentScale = ContentScale.FillWidth,
                    colorFilter = pdfColorFilter,
                    modifier = Modifier.fillMaxWidth().graphicsLayer {
                        scaleX = uiState.zoomScale; scaleY = uiState.zoomScale
                    }
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxWidth().height(480.dp).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text("${index + 1}", color = Color.Gray.copy(0.3f), fontSize = 12.sp)
                }
            }
        }
    }
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

@Composable
private fun ReaderTopBar(
    title: String,
    currentPage: Int,
    totalPages: Int,
    isBookmarked: Boolean,
    accentColor: Color,
    onBack: () -> Unit,
    onBookmark: () -> Unit,
    onToc: () -> Unit,
    onSettings: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(listOf(Color.Black.copy(0.72f), Color.Transparent))
            )
            .systemBarsPadding()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, null, tint = Color.White)
        }
        Text(
            text = title,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(horizontal = 4.dp)
        )
        Text(
            "$currentPage/$totalPages",
            color = Color.White.copy(0.65f),
            fontSize = 11.sp
        )
        IconButton(onClick = onBookmark) {
            Icon(
                if (isBookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                null,
                tint = if (isBookmarked) accentColor else Color.White.copy(0.7f)
            )
        }
        IconButton(onClick = onToc) {
            Icon(Icons.Default.FormatListBulleted, null, tint = Color.White.copy(0.7f))
        }
        IconButton(onClick = onSettings) {
            Icon(Icons.Default.Tune, null, tint = Color.White.copy(0.7f))
        }
    }
}

// ─── Bottom Bar ────────────────────────────────────────────────────────────────

@Composable
private fun ReaderBottomBar(
    currentPage: Int,
    totalPages: Int,
    accentColor: Color,
    onPageChange: (Int) -> Unit,
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
    onResetZoom: () -> Unit,
    onPageInputTap: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.75f))))
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Slider row
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { onPageChange(currentPage - 1) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.ChevronLeft, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
            Slider(
                value = currentPage.toFloat(),
                onValueChange = { onPageChange(it.toInt()) },
                valueRange = 1f..totalPages.toFloat().coerceAtLeast(1f),
                modifier = Modifier.weight(1f),
                colors = SliderDefaults.colors(
                    thumbColor = accentColor,
                    activeTrackColor = accentColor,
                    inactiveTrackColor = Color.White.copy(0.25f)
                )
            )
            IconButton(onClick = { onPageChange(currentPage + 1) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.ChevronRight, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
        }

        // Tools row
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                CircleIconBtn(Icons.Default.ZoomOut) { onZoomOut() }
                CircleIconBtn(Icons.Default.ZoomIn)  { onZoomIn() }
                CircleIconBtn(Icons.Default.FitScreen) { onResetZoom() }
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(0.12f))
                    .clickable(onClick = onPageInputTap)
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text("$currentPage / $totalPages", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun CircleIconBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(32.dp).clip(CircleShape).background(Color.White.copy(0.12f)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(16.dp)) }
}

// ─── TTS Bar ─────────────────────────────────────────────────────────────────

@Composable
private fun TtsBar(
    isSpeaking: Boolean,
    voice: TtsVoice,
    error: String?,
    accentColor: Color,
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onDismissError: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = RoundedCornerShape(40.dp),
            color = Color.Black.copy(0.82f),
            shadowElevation = 8.dp
        ) {
            if (error != null) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Warning, null, tint = Color(0xFFF59E0B), modifier = Modifier.size(14.dp))
                    Text(error, color = Color.White.copy(0.8f), fontSize = 12.sp, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismissError, modifier = Modifier.size(20.dp)) {
                        Icon(Icons.Default.Close, null, tint = Color.White.copy(0.5f), modifier = Modifier.size(12.dp))
                    }
                }
            } else {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    val voiceIcon = if (voice == TtsVoice.FEMALE) Icons.Default.RecordVoiceOver else Icons.Default.VoiceChat
                    Icon(voiceIcon, null, tint = accentColor, modifier = Modifier.size(16.dp))
                    Text(
                        text = if (isSpeaking) "Reading…" else "Read aloud",
                        color = Color.White.copy(0.8f),
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    // TTS speaking wave animation
                    if (isSpeaking) {
                        val infiniteTransition = rememberInfiniteTransition(label = "wave")
                        val heights = (1..4).map { i ->
                            infiniteTransition.animateFloat(
                                initialValue = 3f, targetValue = 14f,
                                animationSpec = infiniteRepeatable(
                                    tween(300 + i * 80, easing = FastOutSlowInEasing),
                                    RepeatMode.Reverse
                                ), label = "h$i"
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                            heights.forEach { h ->
                                Box(modifier = Modifier.width(3.dp).height(h.value.dp).clip(RoundedCornerShape(2.dp)).background(accentColor))
                            }
                        }
                    }
                    IconButton(
                        onClick = if (isSpeaking) onStop else onPlay,
                        modifier = Modifier.size(36.dp).clip(CircleShape).background(accentColor)
                    ) {
                        Icon(
                            if (isSpeaking) Icons.Default.Stop else Icons.Default.PlayArrow,
                            null, tint = Color.White, modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

// ─── TOC Panel ─────────────────────────────────────────────────────────────────

@Composable
private fun TocPanel(
    toc: List<TocItem>,
    bgColor: Color, textColor: Color, accentColor: Color,
    onClose: () -> Unit,
    onItemClick: (Int) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxHeight().width(270.dp),
        color = bgColor.copy(0.97f),
        shadowElevation = 20.dp
    ) {
        Column(modifier = Modifier.fillMaxSize().systemBarsPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Contents", color = textColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, null, tint = textColor.copy(0.5f))
                }
            }
            HorizontalDivider(color = textColor.copy(0.08f))
            if (toc.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No table of contents", color = textColor.copy(0.35f), fontSize = 13.sp)
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)) {
                    items(toc.size) { i ->
                        val item = toc[i]
                        Text(
                            text = item.title,
                            color = textColor.copy(if (item.level == 0) 0.9f else 0.65f),
                            fontSize = if (item.level == 0) 14.sp else 13.sp,
                            fontWeight = if (item.level == 0) FontWeight.SemiBold else FontWeight.Normal,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onItemClick(item.page) }
                                .padding(start = (8 + item.level * 12).dp, top = 10.dp, bottom = 10.dp)
                        )
                    }
                }
            }
        }
    }
}
