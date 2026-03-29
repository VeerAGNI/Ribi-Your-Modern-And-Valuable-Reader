package com.veuros.ribi.data.local

import androidx.room.*
import com.veuros.ribi.data.model.BookMetadata
import kotlinx.coroutines.flow.Flow

@Dao
interface BookDao {

    @Query("SELECT * FROM books ORDER BY lastRead DESC")
    fun getAllBooks(): Flow<List<BookMetadata>>

    @Query("SELECT * FROM books WHERE id = :id")
    suspend fun getBookById(id: String): BookMetadata?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBook(book: BookMetadata)

    @Update
    suspend fun updateBook(book: BookMetadata)

    @Query("DELETE FROM books WHERE id = :id")
    suspend fun deleteBook(id: String)

    @Query("SELECT COUNT(*) FROM books")
    suspend fun getBookCount(): Int

    @Query("UPDATE books SET currentPage = :page, lastRead = :lastRead WHERE id = :id")
    suspend fun updateProgress(id: String, page: Int, lastRead: Long)
}
