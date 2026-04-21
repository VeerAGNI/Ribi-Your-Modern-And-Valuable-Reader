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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
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
        val intent = Intent(context, MusicService::class.java)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        onDispose {
            context.unbindService(serviceConnection)
        }
    }

    // Sync music
    LaunchedEffect(uiState.settings.backgroundMusic, uiState.settings.volume) {
        musicService?.playTrack(uiState.settings.backgroundMusic, uiState.settings.volume)
            ?: run {
                if (uiState.settings.backgroundMusic != null) {
                    val intent = Intent(context, MusicService::class.java)
                    context.startService(intent)
                }
            }
    }

    // Auto-scroll
    LaunchedEffect(uiState.settings.isAutoScrolling, uiState.settings.autoScrollSpeed) {
        if (uiState.settings.isAutoScrolling && uiState.settings.viewMode == ViewMode.CONTINUOUS) {
            // Auto scroll is handled in the continuous scroll view
        }
    }

    val settings = uiState.settings
    val theme = AppThemes.get(settings.theme)
    val bgColor    = Color(theme.bg)
    val textColor  = Color(theme.text)
    val accentColor = Color(theme.accent)

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
            uiState.isLoading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        CircularProgressIndicator(color = accentColor)
                        Text("Opening book...", color = textColor.copy(0.6f))
                    }
                }
            }
            uiState.loadError != null -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(32.dp)) {
                        Icon(Icons.Default.ErrorOutline, null, tint = Color(0xFFEF4444), modifier = Modifier.size(48.dp))
                        Text("Failed to open book", color = textColor, fontWeight = FontWeight.Bold)
                        Text(uiState.loadError ?: "", color = textColor.copy(0.6f), fontSize = 13.sp)
                        Button(onClick = onBack, colors = ButtonDefaults.buttonColors(containerColor = accentColor)) {
                            Text("Go Back")
                        }
                    }
                }
            }
            else -> {
                // Main PDF view
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onTap = { viewModel.showHud() },
                                onDoubleTap = { viewModel.toggleHud() }
                            )
                        }
                ) {
                    if (settings.viewMode == ViewMode.PAGE) {
                        PageModeView(
                            renderedPage = renderedPage,
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            brightness = settings.brightness,
                            zoomScale = uiState.zoomScale,
                            bgColor = bgColor,
                            onSwipeLeft = { viewModel.nextPage() },
                            onSwipeRight = { viewModel.previousPage() },
                            onTap = { viewModel.showHud() }
                        )
                    } else {
                        ContinuousScrollView(
                            viewModel = viewModel,
                            uiState = uiState,
                            bgColor = bgColor,
                            onPageVisible = { page -> viewModel.goToPage(page) }
                        )
                    }

                    // HUD overlay
                    AnimatedVisibility(
                        visible = uiState.isHudVisible,
                        enter = fadeIn() + slideInVertically(initialOffsetY = { -it }),
                        exit = fadeOut() + slideOutVertically(targetOffsetY = { -it }),
                        modifier = Modifier.align(Alignment.TopCenter)
                    ) {
                        ReaderTopBar(
                            title = uiState.book?.title ?: "",
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            isBookmarked = uiState.isBookmarked,
                            textColor = textColor,
                            accentColor = accentColor,
                            onBack = onBack,
                            onBookmark = { viewModel.toggleBookmark() },
                            onToc = { viewModel.toggleToc() },
                            onSettings = { showSettings = true }
                        )
                    }

                    // Bottom HUD
                    AnimatedVisibility(
                        visible = uiState.isHudVisible,
                        enter = fadeIn() + slideInVertically(initialOffsetY = { it }),
                        exit = fadeOut() + slideOutVertically(targetOffsetY = { it }),
                        modifier = Modifier.align(Alignment.BottomCenter)
                    ) {
                        ReaderBottomBar(
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            textColor = textColor,
                            accentColor = accentColor,
                            bgColor = bgColor,
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

                    // TOC overlay
                    AnimatedVisibility(
                        visible = uiState.showToc,
                        enter = slideInHorizontally(initialOffsetX = { it }),
                        exit = slideOutHorizontally(targetOffsetX = { it }),
                        modifier = Modifier.align(Alignment.CenterEnd)
                    ) {
                        TocPanel(
                            toc = uiState.toc,
                            bgColor = bgColor, textColor = textColor, accentColor = accentColor,
                            onClose = { viewModel.toggleToc() },
                            onItemClick = { page ->
                                viewModel.goToPage(page)
                                viewModel.toggleToc()
                            }
                        )
                    }
                }
            }
        }

        // Achievement toast
        Box(modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 8.dp)) {
            AchievementToast(
                achievement = uiState.newAchievement,
                onDismiss = viewModel::dismissAchievement
            )
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
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Settings", color = textColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    IconButton(onClick = { showSettings = false }) {
                        Icon(Icons.Default.Close, null, tint = textColor.copy(0.6f))
                    }
                }
                SettingsPanel(
                    settings = uiState.settings,
                    bgColor = bgColor, textColor = textColor, accentColor = accentColor,
                    onThemeChange = viewModel::updateTheme,
                    onViewModeChange = viewModel::updateViewMode,
                    onBrightnessChange = viewModel::updateBrightness,
                    onRenderQualityChange = viewModel::updateRenderQuality,
                    onAutoNightModeChange = viewModel::updateAutoNightMode,
                    onAutoScrollChange = viewModel::updateAutoScroll,
                    onMusicChange = viewModel::updateMusic,
                    onVolumeChange = viewModel::updateVolume
                )
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    // Page input dialog
    if (showPageInput) {
        AlertDialog(
            onDismissRequest = { showPageInput = false },
            containerColor = bgColor,
            titleContentColor = textColor,
            title = { Text("Go to Page") },
            text = {
                OutlinedTextField(
                    value = pageInputText,
                    onValueChange = { pageInputText = it.filter { c -> c.isDigit() } },
                    label = { Text("Page (1–${uiState.totalPages})") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accentColor,
                        unfocusedBorderColor = textColor.copy(0.3f),
                        focusedTextColor = textColor,
                        unfocusedTextColor = textColor,
                        cursorColor = accentColor,
                        focusedLabelColor = accentColor,
                        unfocusedLabelColor = textColor.copy(0.5f)
                    )
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    pageInputText.toIntOrNull()?.let { viewModel.goToPage(it) }
                    showPageInput = false
                }) {
                    Text("Go", color = accentColor, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showPageInput = false }) {
                    Text("Cancel", color = textColor.copy(0.6f))
                }
            }
        )
    }
}

// ─── Page Mode View ───────────────────────────────────────────────────────────

@Composable
private fun PageModeView(
    renderedPage: android.graphics.Bitmap?,
    currentPage: Int,
    totalPages: Int,
    brightness: Float,
    zoomScale: Float,
    bgColor: Color,
    onSwipeLeft: () -> Unit,
    onSwipeRight: () -> Unit,
    onTap: () -> Unit
) {
    var offsetX by remember { mutableFloatStateOf(0f) }
    val animatedOffsetX by animateFloatAsState(
        targetValue = offsetX, animationSpec = spring(), label = "swipe"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .graphicsLayer { alpha = brightness }
            .pointerInput(currentPage) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        when {
                            offsetX < -100f -> { onSwipeLeft(); offsetX = 0f }
                            offsetX > 100f  -> { onSwipeRight(); offsetX = 0f }
                            else            -> { offsetX = 0f }
                        }
                    }
                ) { _, dragAmount ->
                    offsetX += dragAmount
                }
            }
            .graphicsLayer { translationX = animatedOffsetX },
        contentAlignment = Alignment.Center
    ) {
        if (renderedPage != null && !renderedPage.isRecycled) {
            androidx.compose.foundation.Image(
                bitmap = renderedPage.asImageBitmap(),
                contentDescription = "Page $currentPage",
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = zoomScale
                        scaleY = zoomScale
                    }
            )
        } else {
            CircularProgressIndicator(color = Color(0xFF3B82F6))
        }
    }
}

// ─── Continuous Scroll View ───────────────────────────────────────────────────

@Composable
private fun ContinuousScrollView(
    viewModel: ReaderViewModel,
    uiState: ReaderUiState,
    bgColor: Color,
    onPageVisible: (Int) -> Unit
) {
    val lazyListState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    // Auto-scroll
    LaunchedEffect(uiState.settings.isAutoScrolling, uiState.settings.autoScrollSpeed) {
        if (uiState.settings.isAutoScrolling && uiState.settings.autoScrollSpeed > 0) {
            while (true) {
                val scrollPx = (uiState.settings.autoScrollSpeed * 0.5f).toInt()
                lazyListState.scrollBy(scrollPx.toFloat())
                delay(16L)
            }
        }
    }

    // Track visible page
    LaunchedEffect(lazyListState.firstVisibleItemIndex) {
        val visiblePage = lazyListState.firstVisibleItemIndex + 1
        onPageVisible(visiblePage)
    }

    LazyColumn(
        state = lazyListState,
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        contentPadding = PaddingValues(vertical = 56.dp)
    ) {
        items(uiState.totalPages) { index ->
            val pageNum = index + 1
            SinglePageItem(
                pageNumber = pageNum,
                viewModel = viewModel,
                brightness = uiState.settings.brightness,
                zoomScale = uiState.zoomScale
            )
        }
    }
}

@Composable
private fun SinglePageItem(
    pageNumber: Int,
    viewModel: ReaderViewModel,
    brightness: Float,
    zoomScale: Float
) {
    val renderedPage by viewModel.renderedPage.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp)
            .graphicsLayer { alpha = brightness },
        contentAlignment = Alignment.Center
    ) {
        // We only show the currently rendered page in continuous mode for simplicity
        // A production app would implement per-page rendering
        if (renderedPage != null && !renderedPage!!.isRecycled) {
            androidx.compose.foundation.Image(
                bitmap = renderedPage!!.asImageBitmap(),
                contentDescription = "Page $pageNumber",
                contentScale = ContentScale.FillWidth,
                modifier = Modifier
                    .fillMaxWidth()
                    .graphicsLayer {
                        scaleX = zoomScale
                        scaleY = zoomScale
                    }
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(500.dp)
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Text("$pageNumber", color = Color.Gray.copy(0.4f), fontSize = 14.sp)
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
    textColor: Color,
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
                Brush.verticalGradient(
                    colors = listOf(Color.Black.copy(0.6f), Color.Transparent)
                )
            )
            .systemBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp),
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
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
        )
        Text(
            text = "$currentPage / $totalPages",
            color = Color.White.copy(0.7f),
            fontSize = 12.sp
        )
        IconButton(onClick = onBookmark) {
            Icon(
                if (isBookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                null,
                tint = if (isBookmarked) accentColor else Color.White.copy(0.7f)
            )
        }
        IconButton(onClick = onToc) {
            Icon(Icons.Default.List, null, tint = Color.White.copy(0.7f))
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
    textColor: Color,
    accentColor: Color,
    bgColor: Color,
    onPageChange: (Int) -> Unit,
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
    onResetZoom: () -> Unit,
    onPageInputTap: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color.Transparent, Color.Black.copy(0.7f))
                )
            )
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Page slider
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
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
                    inactiveTrackColor = Color.White.copy(0.3f)
                )
            )
            IconButton(onClick = { onPageChange(currentPage + 1) }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.ChevronRight, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
        }

        // Tools row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Zoom controls
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SmallIconButton(Icons.Default.ZoomOut, "Zoom out") { onZoomOut() }
                SmallIconButton(Icons.Default.ZoomIn, "Zoom in") { onZoomIn() }
                SmallIconButton(Icons.Default.FitScreen, "Reset zoom") { onResetZoom() }
            }

            // Page input
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(0.15f))
                    .clickable(onClick = onPageInputTap)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "$currentPage / $totalPages",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun SmallIconButton(icon: androidx.compose.ui.graphics.vector.ImageVector, desc: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(Color.White.copy(0.15f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, desc, tint = Color.White, modifier = Modifier.size(16.dp))
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
        modifier = Modifier.fillMaxHeight().width(280.dp),
        color = bgColor,
        shadowElevation = 16.dp
    ) {
        Column(modifier = Modifier.fillMaxSize().systemBarsPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Contents", color = textColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, null, tint = textColor.copy(0.6f))
                }
            }
            if (toc.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No table of contents", color = textColor.copy(0.4f), fontSize = 13.sp)
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp)) {
                    items(toc.size) { i ->
                        val item = toc[i]
                        Text(
                            text = item.title,
                            color = textColor.copy(if (item.level == 0) 1f else 0.7f),
                            fontSize = if (item.level == 0) 14.sp else 13.sp,
                            fontWeight = if (item.level == 0) FontWeight.SemiBold else FontWeight.Normal,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onItemClick(item.page) }
                                .padding(
                                    start = (8 + item.level * 12).dp,
                                    top = 10.dp, bottom = 10.dp
                                )
                        )
                    }
                }
            }
        }
    }
}
