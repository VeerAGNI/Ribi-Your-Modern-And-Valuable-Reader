package com.veuros.ribi.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.veuros.ribi.data.local.BookDao
import com.veuros.ribi.data.model.Bookmark
import com.veuros.ribi.data.model.BookMetadata
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BookRepository @Inject constructor(
    private val bookDao: BookDao,
    private val context: Context,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val TAG = "BookRepository"
        private const val MAX_PDF_SIZE = 40L * 1024 * 1024 // 40 MB
    }

    val books: Flow<List<BookMetadata>> = bookDao.getAllBooks()

    suspend fun importPdf(uri: Uri, customTitle: String? = null): Result<BookMetadata> {
        return withContext(Dispatchers.IO) {
            try {
                val contentResolver = context.contentResolver
                val inputStream = contentResolver.openInputStream(uri)
                    ?: return@withContext Result.failure(Exception("Cannot open file"))

                val size = contentResolver.openFileDescriptor(uri, "r")?.statSize ?: 0L
                if (size > MAX_PDF_SIZE) {
                    return@withContext Result.failure(Exception("File too large. Max 40 MB."))
                }

                val bookId = UUID.randomUUID().toString()
                val pdfDir = File(context.filesDir, "pdfs").also { it.mkdirs() }
                val destFile = File(pdfDir, "$bookId.pdf")

                inputStream.use { input ->
                    FileOutputStream(destFile).use { output ->
                        input.copyTo(output)
                    }
                }

                val pfd = ParcelFileDescriptor.open(destFile, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                val totalPages = renderer.pageCount

                // Extract title from PDF metadata (filename fallback)
                val title = customTitle
                    ?: extractPdfTitle(uri)
                    ?: destFile.nameWithoutExtension

                // Generate cover thumbnail from first page
                val coverPath = generateCoverThumbnail(renderer, bookId)
                renderer.close()
                pfd.close()

                val book = BookMetadata(
                    id             = bookId,
                    title          = title,
                    originalName   = uri.lastPathSegment ?: "",
                    totalPages     = totalPages,
                    currentPage    = 1,
                    maxPageReached = 1,
                    lastRead       = System.currentTimeMillis(),
                    filePath       = destFile.absolutePath,
                    coverImagePath = coverPath
                )

                bookDao.insertBook(book)
                syncBookToFirestore(book)
                Result.success(book)
            } catch (e: Exception) {
                Log.e(TAG, "Error importing PDF", e)
                Result.failure(e)
            }
        }
    }

    private fun extractPdfTitle(uri: Uri): String? {
        return try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                cursor.moveToFirst()
                cursor.getString(nameIndex)?.removeSuffix(".pdf")
            }
        } catch (e: Exception) { null }
    }

    private fun generateCoverThumbnail(renderer: PdfRenderer, bookId: String): String? {
        return try {
            val page = renderer.openPage(0)
            val scale = 300f / page.width
            val width = (page.width * scale).toInt()
            val height = (page.height * scale).toInt()
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()

            val coverDir = File(context.filesDir, "covers").also { it.mkdirs() }
            val coverFile = File(coverDir, "$bookId.jpg")
            FileOutputStream(coverFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
            }
            bitmap.recycle()
            coverFile.absolutePath
        } catch (e: Exception) {
            Log.w(TAG, "Could not generate cover", e)
            null
        }
    }

    suspend fun updateProgress(bookId: String, page: Int) {
        withContext(Dispatchers.IO) {
            val now = System.currentTimeMillis()
            bookDao.updateProgress(bookId, page, now)
            val book = bookDao.getBookById(bookId) ?: return@withContext
            val updated = book.copy(
                currentPage    = page,
                maxPageReached = maxOf(book.maxPageReached, page),
                lastRead       = now
            )
            bookDao.updateBook(updated)
            syncBookToFirestore(updated)
        }
    }

    suspend fun toggleBookmark(bookId: String, page: Int) {
        withContext(Dispatchers.IO) {
            val book = bookDao.getBookById(bookId) ?: return@withContext
            val existing = book.bookmarks.find { it.pageNumber == page }
            val updated = if (existing != null) {
                book.copy(bookmarks = book.bookmarks.filter { it.id != existing.id })
            } else {
                val newBm = Bookmark(
                    id         = UUID.randomUUID().toString(),
                    pageNumber = page,
                    label      = "Page $page",
                    timestamp  = System.currentTimeMillis()
                )
                book.copy(bookmarks = book.bookmarks + newBm)
            }
            bookDao.updateBook(updated)
            syncBookToFirestore(updated)
        }
    }

    suspend fun deleteBook(bookId: String) {
        withContext(Dispatchers.IO) {
            val book = bookDao.getBookById(bookId) ?: return@withContext
            // Delete PDF file
            File(book.filePath).takeIf { it.exists() }?.delete()
            // Delete cover
            book.coverImagePath?.let { File(it).takeIf { f -> f.exists() }?.delete() }
            bookDao.deleteBook(bookId)
            deleteBookFromFirestore(bookId)
        }
    }

    suspend fun renameBook(bookId: String, newTitle: String) {
        withContext(Dispatchers.IO) {
            val book = bookDao.getBookById(bookId) ?: return@withContext
            val updated = book.copy(title = newTitle)
            bookDao.updateBook(updated)
            syncBookToFirestore(updated)
        }
    }

    private suspend fun syncBookToFirestore(book: BookMetadata) {
        val uid = auth.currentUser?.uid ?: return
        try {
            val data = mapOf(
                "id"             to book.id,
                "title"          to book.title,
                "totalPages"     to book.totalPages,
                "currentPage"    to book.currentPage,
                "maxPageReached" to book.maxPageReached,
                "lastRead"       to book.lastRead,
                "bookmarks"      to book.bookmarks.map { bm ->
                    mapOf("id" to bm.id, "pageNumber" to bm.pageNumber,
                          "label" to bm.label, "timestamp" to bm.timestamp)
                }
            )
            firestore.collection("users").document(uid)
                .collection("books").document(book.id)
                .set(data, SetOptions.merge())
                .await()
        } catch (e: Exception) {
            Log.w(TAG, "Firestore sync failed", e)
        }
    }

    private suspend fun deleteBookFromFirestore(bookId: String) {
        val uid = auth.currentUser?.uid ?: return
        try {
            firestore.collection("users").document(uid)
                .collection("books").document(bookId)
                .delete().await()
        } catch (e: Exception) {
            Log.w(TAG, "Firestore delete failed", e)
        }
    }
}
