import React, { useState, useEffect } from 'react';
import { BookOpenCheck, Search, Loader2, Plus, X } from 'lucide-react';
import { BookIssue, User, Book } from '../../types';
import { firestoreService } from '../../src/services/firestoreService';
import { where, orderBy, QueryConstraint } from 'firebase/firestore';

interface IssuesProps {
  user: User;
}

const FINE_PER_DAY = 5.0; // Fine per day in local currency

const calculateFine = (dueDateStr: string, returnDateStr?: string) => {
  const dueDate = new Date(dueDateStr);
  const compareDate = returnDateStr ? new Date(returnDateStr) : new Date();
  
  // Set times to midnight for accurate day calculation
  dueDate.setHours(0, 0, 0, 0);
  compareDate.setHours(0, 0, 0, 0);
  
  if (compareDate <= dueDate) return 0;
  
  const diffTime = Math.abs(compareDate.getTime() - dueDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays * FINE_PER_DAY;
};

const Issues: React.FC<IssuesProps> = ({ user }) => {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Issue form state
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('issueDate', 'desc')];
    if (user.role !== 'admin' && user.role !== 'hod') {
      constraints.push(where('userId', '==', user.uid));
    }

    const unsubscribeIssues = firestoreService.subscribeToCollection('bookIssues', constraints, async (data) => {
      const enriched = await Promise.all(data.map(async (issue: any) => {
        const book = await firestoreService.getDoc<Book>('books', issue.bookId);
        const member = await firestoreService.getDoc<User>('users', issue.userId);
        let department = null;
        if (member?.departmentId) {
          department = await firestoreService.getDoc<any>('departments', member.departmentId);
        }
        return { ...issue, book, user: member, department };
      }));
      
      let finalIssues = enriched;
      if (user.role === 'hod') {
        finalIssues = enriched.filter(i => i.user?.departmentId === user.departmentId);
      }
      
      setIssues(finalIssues);
      setLoading(false);
    });

    if (user.role === 'admin' || user.role === 'hod') {
      const unsubscribeBooks = firestoreService.subscribeToCollection<Book>('books', [], (data) => {
        setBooks(data);
      });
      const unsubscribeUsers = firestoreService.subscribeToCollection<User>('users', [], (data) => {
        setUsers(data);
      });
      return () => {
        unsubscribeIssues();
        unsubscribeBooks();
        unsubscribeUsers();
      };
    }

    return () => unsubscribeIssues();
  }, [user]);

  const handleReturn = async (id: string) => {
    try {
      const issue = issues.find(i => i.id === id);
      if (!issue) return;

      const returnDate = new Date().toISOString();
      const fineAmount = calculateFine(issue.dueDate, returnDate);

      await firestoreService.updateDoc('bookIssues', id, {
        status: 'returned',
        returnDate: returnDate,
        fineAmount: fineAmount
      });

      // Increment available copies
      const book = await firestoreService.getDoc<Book>('books', issue.bookId);
      if (book) {
        await firestoreService.updateDoc('books', issue.bookId, {
          availableCopies: (book.availableCopies || 0) + 1
        });
      }
    } catch (error) {
      console.error('Failed to return book', error);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !selectedUser || !dueDate) return;
    
    setIssuing(true);
    try {
      const book = await firestoreService.getDoc<Book>('books', selectedBook);
      if (!book || book.availableCopies <= 0) {
        alert('Book not available');
        return;
      }

      await firestoreService.addDoc('bookIssues', {
        bookId: selectedBook,
        userId: selectedUser,
        issueDate: new Date().toISOString(),
        dueDate,
        status: 'issued',
        fineAmount: 0
      });

      // Decrement available copies
      await firestoreService.updateDoc('books', selectedBook, {
        availableCopies: book.availableCopies - 1
      });

      setShowIssueModal(false);
      setSelectedBook('');
      setSelectedUser('');
      setDueDate('');
    } catch (error) {
      console.error('Failed to issue book', error);
      alert('Failed to issue book');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Issues & Returns</h2>
          <p className="text-slate-500">Track book issues, returns, and overdues.</p>
        </div>
        
        {user.role === 'admin' && (
          <button 
            onClick={() => setShowIssueModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Issue Book
          </button>
        )}
      </div>

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Issue Book</h3>
              <button 
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleIssue} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Book</label>
                <select 
                  required
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select a book</option>
                  {books.filter(b => b.availableCopies > 0).map(book => (
                    <option key={book.id} value={book.id}>{book.title} ({book.availableCopies} available)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">User</label>
                <select 
                  required
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select a user</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input 
                  type="date" 
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={issuing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {issuing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Issue Book
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Book</th>
                  {(user.role === 'admin' || user.role === 'hod') && (
                    <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">User & Department</th>
                  )}
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Issue Date</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Due Date</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Fine</th>
                  {user.role === 'admin' && (
                    <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {issues.map(issue => (
                  <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-slate-900 dark:text-white">{issue.book?.title || 'Unknown Book'}</p>
                      <p className="text-xs text-slate-500 font-mono">{issue.bookId}</p>
                    </td>
                    {(user.role === 'admin' || user.role === 'hod') && (
                      <td className="p-4">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{issue.user?.name || 'Unknown User'}</p>
                        <p className="text-xs text-slate-500">{issue.department?.name || 'No Department'}</p>
                      </td>
                    )}
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(issue.issueDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(issue.dueDate).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        issue.status === 'issued' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                        issue.status === 'returned' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                      ₹{issue.status === 'returned' ? (issue.fineAmount || 0).toFixed(2) : calculateFine(issue.dueDate).toFixed(2)}
                    </td>
                    {user.role === 'admin' && (
                      <td className="p-4 text-right">
                        {issue.status === 'issued' && (
                          <button 
                            onClick={() => handleReturn(issue.id)}
                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                          >
                            Return
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No issues found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Issues;
