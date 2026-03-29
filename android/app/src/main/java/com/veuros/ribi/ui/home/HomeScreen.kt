package com.veuros.ribi.ui.home

import android.net.Uri
import android.content.Context
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.ui.platform.LocalContext
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.veuros.ribi.data.model.*
import com.veuros.ribi.ui.components.AchievementToast
import com.veuros.ribi.ui.settings.SettingsPanel
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenBook: (String) -> Unit,
    onSignOut: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)

    val settings = uiState.settings
    val theme = AppThemes.get(settings.theme)
    val bgColor    = Color(theme.bg)
    val textColor  = Color(theme.text)
    val accentColor = Color(theme.accent)
    val secondaryColor = Color(theme.secondary)

    var showDeleteDialog by remember { mutableStateOf<BookMetadata?>(null) }
    var showUploadSheet by remember { mutableStateOf(false) }
    var pendingUri by remember { mutableStateOf<Uri?>(null) }
    var pendingTitle by remember { mutableStateOf("") }

    val pdfPickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let {
            pendingUri = it
            // Extract display name for default title
            try {
                val cursor = context.contentResolver.query(it, null, null, null, null)
                cursor?.use { c ->
                    val nameIndex = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (c.moveToFirst() && nameIndex >= 0) {
                        pendingTitle = c.getString(nameIndex).removeSuffix(".pdf").trim()
                    }
                }
            } catch (_: Exception) {}
            showUploadSheet = true
        }
    }

    // Music service binding handled here simply via ViewModel

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.fillMaxWidth(0.85f),
                drawerContainerColor = bgColor,
                drawerContentColor = textColor
            ) {
                DrawerContent(
                    uiState = uiState,
                    bgColor = bgColor,
                    textColor = textColor,
                    accentColor = accentColor,
                    secondaryColor = secondaryColor,
                    onBookSelect = { bookId ->
                        scope.launch { drawerState.close() }
                        onOpenBook(bookId)
                    },
                    onDeleteBook = { showDeleteDialog = it },
                    onAddPdf = { pdfPickerLauncher.launch(arrayOf("application/pdf")) },
                    onThemeChange = viewModel::updateTheme,
                    onViewModeChange = viewModel::updateViewMode,
                    onBrightnessChange = viewModel::updateBrightness,
                    onRenderQualityChange = viewModel::updateRenderQuality,
                    onAutoNightModeChange = viewModel::updateAutoNightMode,
                    onAutoScrollChange = viewModel::updateAutoScroll,
                    onMusicChange = viewModel::updateMusic,
                    onVolumeChange = viewModel::updateVolume,
                    onSignOut = onSignOut,
                    onDismissTip = viewModel::setSeenTip,
                    activeTab = uiState.drawerTab,
                    onTabChange = viewModel::setDrawerTab
                )
            }
        }
    ) {
        // Main content
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(bgColor)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .systemBarsPadding()
            ) {
                // Top bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                        Icon(Icons.Default.MenuBook, null, tint = textColor, modifier = Modifier.size(28.dp))
                    }
                    IconButton(onClick = { scope.launch { drawerState.open() }; viewModel.setDrawerTab(DrawerTab.SETTINGS) }) {
                        Icon(Icons.Default.Settings, null, tint = textColor.copy(0.7f))
                    }
                }

                // Dashboard
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    item {
                        // Greeting
                        Column {
                            Text(
                                text = if (uiState.userName.isNotEmpty()) "Hello, ${uiState.userName}" else "Hello!",
                                color = textColor,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Continue Reading & Becoming",
                                color = textColor.copy(0.5f),
                                fontSize = 13.sp
                            )
                        }
                    }

                    // Streak card
                    item {
                        StreakCard(
                            streak = uiState.settings.stats.streak,
                            totalPages = uiState.settings.stats.totalPagesRead,
                            bgColor = secondaryColor,
                            textColor = textColor,
                            accentColor = accentColor
                        )
                    }

                    // Quick actions
                    if (uiState.books.isNotEmpty()) {
                        item {
                            val lastBook = uiState.books.maxByOrNull { it.lastRead }
                            if (lastBook != null) {
                                QuickActionCard(
                                    book = lastBook,
                                    bgColor = secondaryColor,
                                    textColor = textColor,
                                    accentColor = accentColor,
                                    onContinue = { onOpenBook(lastBook.id) },
                                    onLibrary = { scope.launch { drawerState.open() } }
                                )
                            }
                        }
                    }

                    // Recent books
                    if (uiState.books.isNotEmpty()) {
                        item {
                            Text("Recent Books", color = textColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        }
                        items(uiState.books.sortedByDescending { it.lastRead }.take(5)) { book ->
                            BookCard(
                                book = book,
                                bgColor = secondaryColor,
                                textColor = textColor,
                                accentColor = accentColor,
                                onClick = { onOpenBook(book.id) },
                                onDelete = { showDeleteDialog = book }
                            )
                        }
                    } else {
                        item {
                            EmptyLibraryCard(
                                bgColor = secondaryColor,
                                textColor = textColor,
                                accentColor = accentColor,
                                onAdd = { pdfPickerLauncher.launch(arrayOf("application/pdf")) }
                            )
                        }
                    }

                    item { Spacer(Modifier.height(80.dp)) }
                }
            }

            // FAB
            FloatingActionButton(
                onClick = { pdfPickerLauncher.launch(arrayOf("application/pdf")) },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(24.dp)
                    .navigationBarsPadding(),
                containerColor = accentColor,
                contentColor = Color.White,
                shape = RoundedCornerShape(20.dp),
                elevation = FloatingActionButtonDefaults.elevation(8.dp)
            ) {
                Icon(Icons.Default.Add, "Add PDF", modifier = Modifier.size(26.dp))
            }

            // Achievement toast
            Box(modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 8.dp)) {
                AchievementToast(
                    achievement = uiState.newAchievement,
                    onDismiss = viewModel::dismissAchievement
                )
            }
        }
    }

    // Delete confirmation dialog
    showDeleteDialog?.let { book ->
        AlertDialog(
            onDismissRequest = { showDeleteDialog = null },
            containerColor = bgColor,
            titleContentColor = textColor,
            textContentColor = textColor.copy(0.7f),
            icon = {
                Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444), modifier = Modifier.size(32.dp))
            },
            title = { Text("Delete Book?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "\"${book.title}\" will be permanently removed from your library and device. This cannot be undone.",
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteBook(book.id); showDeleteDialog = null }) {
                    Text("Delete", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = null }) {
                    Text("Cancel", color = textColor.copy(0.7f))
                }
            }
        )
    }

    // Upload bottom sheet
    if (showUploadSheet && pendingUri != null) {
        UploadBottomSheet(
            uri = pendingUri!!,
            initialTitle = pendingTitle,
            bgColor = bgColor,
            textColor = textColor,
            accentColor = accentColor,
            isLoading = uiState.isImporting,
            onConfirm = { title ->
                viewModel.importPdf(pendingUri!!, title)
                showUploadSheet = false
                pendingUri = null
                pendingTitle = ""
            },
            onDismiss = {
                showUploadSheet = false
                pendingUri = null
                pendingTitle = ""
            }
        )
    }
}

@Composable
private fun StreakCard(
    streak: Int,
    totalPages: Int,
    bgColor: Color,
    textColor: Color,
    accentColor: Color
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(accentColor.copy(0.15f), accentColor.copy(0.05f))
                )
            )
            .border(1.dp, accentColor.copy(0.2f), RoundedCornerShape(24.dp))
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("🔥", fontSize = 24.sp)
                    Text(
                        text = "$streak",
                        color = accentColor,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black
                    )
                    Column {
                        Text("day streak", color = textColor.copy(0.8f), fontSize = 12.sp)
                        if (streak == 0) Text("Start reading today!", color = textColor.copy(0.5f), fontSize = 10.sp)
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "$totalPages",
                    color = textColor,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Text("total pages", color = textColor.copy(0.5f), fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun QuickActionCard(
    book: BookMetadata,
    bgColor: Color,
    textColor: Color,
    accentColor: Color,
    onContinue: () -> Unit,
    onLibrary: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .border(1.dp, textColor.copy(0.08f), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Pick up where you left", color = textColor.copy(0.6f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Cover
            BookCoverThumbnail(book = book, size = 56, cornerRadius = 12)
            Column(modifier = Modifier.weight(1f)) {
                Text(book.title, color = textColor, fontWeight = FontWeight.Bold,
                    fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Page ${book.currentPage} / ${book.totalPages}",
                    color = textColor.copy(0.5f), fontSize = 11.sp)
                Spacer(Modifier.height(6.dp))
                // Progress
                val progress = if (book.totalPages > 0) book.currentPage.toFloat() / book.totalPages else 0f
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)),
                    color = accentColor,
                    trackColor = textColor.copy(0.1f)
                )
            }
        }
        Button(
            onClick = onContinue,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = accentColor)
        ) {
            Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("Continue Reading", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun BookCard(
    book: BookMetadata,
    bgColor: Color,
    textColor: Color,
    accentColor: Color,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val progress = if (book.totalPages > 0) book.currentPage.toFloat() / book.totalPages else 0f

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(bgColor)
            .border(1.dp, textColor.copy(0.08f), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BookCoverThumbnail(book = book, size = 52, cornerRadius = 10)

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(book.title, color = textColor, fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Outlined.AccessTime, null, tint = textColor.copy(0.4f), modifier = Modifier.size(9.dp))
                Text(formatTime(book.lastRead), color = textColor.copy(0.4f), fontSize = 10.sp)
                Text("·", color = textColor.copy(0.3f), fontSize = 10.sp)
                Text("p.${book.currentPage}/${book.totalPages}", color = textColor.copy(0.4f), fontSize = 10.sp)
            }
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().height(2.dp).clip(RoundedCornerShape(1.dp)),
                color = accentColor,
                trackColor = textColor.copy(0.1f)
            )
        }

        IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444).copy(0.6f), modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
fun BookCoverThumbnail(book: BookMetadata, size: Int, cornerRadius: Int) {
    Box(
        modifier = Modifier
            .size(size.dp, (size * 1.33f).dp)
            .clip(RoundedCornerShape(cornerRadius.dp))
            .background(Color(0xFF3B82F6).copy(0.1f)),
        contentAlignment = Alignment.Center
    ) {
        val path = book.coverImagePath
        if (path != null && File(path).exists()) {
            AsyncImage(
                model = File(path),
                contentDescription = book.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Icon(Icons.Default.Description, null,
                tint = Color(0xFF3B82F6).copy(0.6f),
                modifier = Modifier.size((size * 0.45f).dp))
        }
    }
}

@Composable
private fun EmptyLibraryCard(bgColor: Color, textColor: Color, accentColor: Color, onAdd: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .clip(RoundedCornerShape(24.dp))
            .border(2.dp, textColor.copy(0.15f), RoundedCornerShape(24.dp)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.MenuBook, null, tint = textColor.copy(0.2f), modifier = Modifier.size(48.dp))
            Text("Your library is empty", color = textColor.copy(0.3f), fontWeight = FontWeight.Medium)
            Text("Tap + to add your first book", color = textColor.copy(0.2f), fontSize = 12.sp)
        }
    }
}

// ─── Drawer Content ────────────────────────────────────────────────────────────

@Composable
private fun DrawerContent(
    uiState: HomeUiState,
    bgColor: Color, textColor: Color, accentColor: Color, secondaryColor: Color,
    onBookSelect: (String) -> Unit,
    onDeleteBook: (BookMetadata) -> Unit,
    onAddPdf: () -> Unit,
    onThemeChange: (AppTheme) -> Unit,
    onViewModeChange: (ViewMode) -> Unit,
    onBrightnessChange: (Float) -> Unit,
    onRenderQualityChange: (Int) -> Unit,
    onAutoNightModeChange: (Boolean) -> Unit,
    onAutoScrollChange: (Boolean, Float) -> Unit,
    onMusicChange: (String?) -> Unit,
    onVolumeChange: (Float) -> Unit,
    onSignOut: () -> Unit,
    onDismissTip: () -> Unit,
    activeTab: DrawerTab,
    onTabChange: (DrawerTab) -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor)
            .systemBarsPadding()
    ) {
        // Drawer header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text("Ribi", color = textColor, fontSize = 26.sp, fontWeight = FontWeight.Black)
                Text("Continue Reading & Becoming", color = textColor.copy(0.4f), fontSize = 11.sp)
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("${uiState.books.size} book${if (uiState.books.size != 1) "s" else ""}",
                    color = textColor.copy(0.3f), fontSize = 11.sp)
                IconButton(onClick = onSignOut) {
                    Icon(Icons.Default.Logout, null, tint = textColor.copy(0.5f), modifier = Modifier.size(18.dp))
                }
            }
        }

        // Tab bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf(
                DrawerTab.LIBRARY to Pair(Icons.Default.Book, "Library"),
                DrawerTab.SETTINGS to Pair(Icons.Default.Tune, "Settings"),
                DrawerTab.BOOKMARKS to Pair(Icons.Default.Bookmark, "Bookmarks"),
                DrawerTab.ABOUT to Pair(Icons.Default.Info, "About")
            ).forEach { (tab, pair) ->
                val (icon, label) = pair
                val selected = activeTab == tab
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (selected) accentColor.copy(0.15f) else Color.Transparent)
                        .clickable { onTabChange(tab) }
                        .padding(vertical = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(icon, null,
                        tint = if (selected) accentColor else textColor.copy(0.5f),
                        modifier = Modifier.size(18.dp))
                    Text(label, color = if (selected) accentColor else textColor.copy(0.5f),
                        fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Divider(modifier = Modifier.padding(vertical = 12.dp, horizontal = 16.dp),
            color = textColor.copy(0.08f))

        // Tab content
        Box(modifier = Modifier.weight(1f)) {
            when (activeTab) {
                DrawerTab.LIBRARY -> LibraryTabContent(
                    books = uiState.books,
                    bgColor = bgColor, textColor = textColor, accentColor = accentColor,
                    secondaryColor = secondaryColor,
                    onBookSelect = onBookSelect, onDeleteBook = onDeleteBook, onAddPdf = onAddPdf,
                    seenTip = uiState.seenTip, onDismissTip = onDismissTip
                )
                DrawerTab.SETTINGS -> SettingsPanel(
                    settings = uiState.settings,
                    bgColor = bgColor, textColor = textColor, accentColor = accentColor,
                    onThemeChange = onThemeChange, onViewModeChange = onViewModeChange,
                    onBrightnessChange = onBrightnessChange,
                    onRenderQualityChange = onRenderQualityChange,
                    onAutoNightModeChange = onAutoNightModeChange,
                    onAutoScrollChange = onAutoScrollChange,
                    onMusicChange = onMusicChange, onVolumeChange = onVolumeChange
                )
                DrawerTab.BOOKMARKS -> BookmarksTabContent(
                    books = uiState.books, textColor = textColor,
                    accentColor = accentColor, onBookSelect = onBookSelect
                )
                DrawerTab.ABOUT -> AboutTabContent(textColor = textColor, accentColor = accentColor)
            }
        }
    }
}

@Composable
private fun LibraryTabContent(
    books: List<BookMetadata>,
    bgColor: Color, textColor: Color, accentColor: Color, secondaryColor: Color,
    onBookSelect: (String) -> Unit, onDeleteBook: (BookMetadata) -> Unit, onAddPdf: () -> Unit,
    seenTip: Boolean, onDismissTip: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (books.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(160.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .border(2.dp, textColor.copy(0.15f), RoundedCornerShape(20.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.Book, null, tint = textColor.copy(0.2f), modifier = Modifier.size(36.dp))
                            Text("Your library is empty", color = textColor.copy(0.3f), fontSize = 13.sp)
                            Text("Tap + to add your first book", color = textColor.copy(0.2f), fontSize = 11.sp)
                        }
                    }
                }
            } else {
                items(books.sortedByDescending { it.lastRead }) { book ->
                    BookCard(
                        book = book, bgColor = secondaryColor,
                        textColor = textColor, accentColor = accentColor,
                        onClick = { onBookSelect(book.id) },
                        onDelete = { onDeleteBook(book) }
                    )
                }
            }

            // Pro tip card
            if (!seenTip) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(Color(0xFF3B82F6).copy(0.9f), Color(0xFF6324DC).copy(0.9f))
                                )
                            )
                            .padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Pro Tip", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    "Try the Midnight theme with rain sounds for an immersive late-night session.",
                                    color = Color.White.copy(0.85f), fontSize = 11.sp, lineHeight = 16.sp
                                )
                            }
                            IconButton(onClick = onDismissTip, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Close, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }

        // Add button
        Button(
            onClick = onAddPdf,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .navigationBarsPadding(),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(containerColor = accentColor),
            elevation = ButtonDefaults.buttonElevation(8.dp)
        ) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Add PDF", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun BookmarksTabContent(
    books: List<BookMetadata>, textColor: Color, accentColor: Color,
    onBookSelect: (String) -> Unit
) {
    val allBookmarks = books.flatMap { book ->
        book.bookmarks.map { bm -> Triple(book, bm, book.id) }
    }.sortedByDescending { it.second.timestamp }

    if (allBookmarks.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.Bookmark, null, tint = textColor.copy(0.2f), modifier = Modifier.size(40.dp))
                Text("No bookmarks yet", color = textColor.copy(0.3f))
                Text("Tap the bookmark icon while reading", color = textColor.copy(0.2f), fontSize = 12.sp)
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(allBookmarks) { (book, bm, bookId) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(textColor.copy(0.06f))
                        .clickable { onBookSelect(bookId) }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(Icons.Default.Bookmark, null, tint = accentColor, modifier = Modifier.size(18.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(book.title, color = textColor, fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("Page ${bm.pageNumber}", color = textColor.copy(0.5f), fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AboutTabContent(textColor: Color, accentColor: Color) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // App info
        Column(horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(accentColor.copy(0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.MenuBook, null, tint = accentColor, modifier = Modifier.size(36.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text("Ribi", color = textColor, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Text("v1.0.0", color = textColor.copy(0.4f), fontSize = 12.sp)
            Spacer(Modifier.height(8.dp))
            Text(
                "Redefining Technology",
                color = textColor.copy(0.5f), fontSize = 12.sp, letterSpacing = 2.sp
            )
        }

        Divider(color = textColor.copy(0.08f))

        // Achievements summary
        val achievements = listOf(
            "📖" to "19 reading milestones to unlock",
            "🔥" to "8 streak achievements to earn",
            "🎵" to "3 ambient background tracks",
            "🎨" to "5 beautiful reading themes"
        )
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Features", color = textColor.copy(0.5f), fontSize = 10.sp,
                fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            achievements.forEach { (icon, text) ->
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(icon, fontSize = 18.sp)
                    Text(text, color = textColor.copy(0.8f), fontSize = 13.sp)
                }
            }
        }

        Divider(color = textColor.copy(0.08f))

        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text("© 2024 Veuros. All rights reserved.", color = textColor.copy(0.4f), fontSize = 11.sp)
            Text(
                "Founded by Veer Agnihotri",
                color = textColor.copy(0.5f), fontSize = 11.sp, fontWeight = FontWeight.Medium
            )
        }
    }
}

// ─── Upload Bottom Sheet ───────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UploadBottomSheet(
    uri: Uri,
    initialTitle: String,
    bgColor: Color, textColor: Color, accentColor: Color,
    isLoading: Boolean,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var title by remember { mutableStateOf(initialTitle) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = bgColor
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Add to Library", color = textColor, fontSize = 18.sp, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Book Name") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = accentColor,
                    unfocusedBorderColor = textColor.copy(0.2f),
                    focusedTextColor = textColor,
                    unfocusedTextColor = textColor,
                    focusedLabelColor = accentColor,
                    unfocusedLabelColor = textColor.copy(0.5f),
                    cursorColor = accentColor
                )
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = textColor)
                ) { Text("Cancel") }

                Button(
                    onClick = { onConfirm(title.ifBlank { "Untitled PDF" }) },
                    enabled = !isLoading,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("Add to Library", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

private fun formatTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    return when {
        diff < 60_000         -> "Just now"
        diff < 3_600_000      -> "${diff / 60_000}m ago"
        diff < 86_400_000     -> "${diff / 3_600_000}h ago"
        diff < 7 * 86_400_000 -> "${diff / 86_400_000}d ago"
        else -> SimpleDateFormat("MMM d", Locale.US).format(Date(timestamp))
    }
}
