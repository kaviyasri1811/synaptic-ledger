import React, { useState, useEffect } from 'react';
import { Book as BookIcon, Search, Plus, Edit, Trash2, Loader2, X } from 'lucide-react';
import { Book, User } from '../../types';
import { firestoreService } from '../../src/services/firestoreService';

interface BooksProps {
  user: User;
}

const Books: React.FC<BooksProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'ebooks'>('catalog');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);

  // Add Book Form State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [coverUrl, setCoverUrl] = useState('');
  const [description, setDescription] = useState('');
  const [ebookUrl, setEbookUrl] = useState('');

  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const unsubscribeBooks = firestoreService.subscribeToCollection<Book>('books', [], (data) => {
      setBooks(data);
      setLoading(false);
    });

    const unsubscribeDepts = firestoreService.subscribeToCollection<{id: string, name: string}>('departments', [], (data) => {
      setDepartments(data);
    });

    return () => {
      unsubscribeBooks();
      unsubscribeDepts();
    };
  }, []);

  const handleReserve = async (bookId: string) => {
    try {
      await firestoreService.addDoc('reservations', {
        bookId,
        userId: user.uid,
        reservationDate: new Date().toISOString(),
        status: 'pending'
      });
      alert('Book reserved successfully!');
    } catch (error) {
      console.error('Failed to reserve book', error);
      alert('An error occurred while reserving the book.');
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await firestoreService.addDoc('books', {
        title,
        author,
        isbn,
        departmentId,
        totalCopies: Number(totalCopies),
        availableCopies: Number(totalCopies),
        coverUrl,
        description,
        ebookUrl: ebookUrl || null
      });
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add book', error);
      alert('Failed to add book');
    } finally {
      setAdding(false);
    }
  };

  const handleEditBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookId) return;
    setEditing(true);
    try {
      await firestoreService.updateDoc('books', editingBookId, {
        title,
        author,
        isbn,
        departmentId,
        totalCopies: Number(totalCopies),
        coverUrl,
        description,
        ebookUrl: ebookUrl || null
      });
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to update book', error);
      alert('Failed to update book');
    } finally {
      setEditing(false);
    }
  };

  const openEditModal = (book: Book) => {
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setDepartmentId(book.departmentId);
    setTotalCopies(book.totalCopies);
    setCoverUrl(book.coverUrl || '');
    setDescription(book.description || '');
    setEbookUrl(book.ebookUrl || '');
    setShowEditModal(true);
  };

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setIsbn('');
    setDepartmentId('');
    setTotalCopies(1);
    setCoverUrl('');
    setDescription('');
    setEbookUrl('');
    setEditingBookId(null);
  };

  const handleDeleteBook = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    try {
      await firestoreService.deleteDoc('books', id);
    } catch (error) {
      console.error('Failed to delete book', error);
      alert('Failed to delete book');
    }
  };

  const filteredBooks = books.filter(b => 
    (b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.isbn.includes(search)) &&
    (activeTab === 'catalog' ? true : !!b.ebookUrl)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Library Books</h2>
          <p className="text-slate-500">Manage and access physical and digital books.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search books..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {user.role === 'admin' && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Book
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'catalog' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Available Books Details
        </button>
        <button
          onClick={() => setActiveTab('ebooks')}
          className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'ebooks' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          E-Book Upload & Access
        </button>
      </div>

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New Book</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddBook} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author</label>
                <input 
                  type="text" 
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ISBN</label>
                  <input 
                    type="text" 
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select 
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Total Copies</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cover Image (optional)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="Image URL or upload file"
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button type="button" className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
                      Upload
                    </button>
                  </div>
                </div>
                {coverUrl && coverUrl.startsWith('data:image') && (
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Image uploaded successfully</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Book URL (optional)</label>
                <input 
                  type="url" 
                  value={ebookUrl}
                  onChange={(e) => setEbookUrl(e.target.value)}
                  placeholder="Link to digital version"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (optional)</label>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                ></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Book</h3>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditBook} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author</label>
                <input 
                  type="text" 
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ISBN</label>
                  <input 
                    type="text" 
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select 
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Total Copies</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cover Image (optional)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="Image URL or upload file"
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button type="button" className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
                      Upload
                    </button>
                  </div>
                </div>
                {coverUrl && coverUrl.startsWith('data:image') && (
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Image uploaded successfully</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Book URL (optional)</label>
                <input 
                  type="url" 
                  value={ebookUrl}
                  onChange={(e) => setEbookUrl(e.target.value)}
                  placeholder="Link to digital version"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (optional)</label>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                ></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={editing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {editing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map(book => (
            <div key={book.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl transition-shadow flex flex-col">
              <div className="h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <BookIcon className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                )}
                <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                  {book.availableCopies} / {book.totalCopies} Available
                </div>
                {book.ebookUrl && (
                  <div className="absolute top-3 left-3 bg-indigo-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm">
                    E-Book Available
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 mb-1">{book.title}</h3>
                <p className="text-slate-500 text-sm mb-4">{book.author}</p>
                <div className="mt-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">ISBN: {book.isbn}</span>
                    {user.role === 'admin' && (
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(book)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteBook(book.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {activeTab === 'catalog' ? (
                      user.role !== 'admin' && (
                        <button 
                          onClick={() => handleReserve(book.id)}
                          disabled={book.availableCopies === 0}
                          className="flex-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reserve Physical
                        </button>
                      )
                    ) : (
                      book.ebookUrl && (
                        <a 
                          href={book.ebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all text-center"
                        >
                          Read E-Book
                        </a>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredBooks.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No books found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Books;
