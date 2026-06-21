import React, { useState, useEffect } from 'react';
import { Bookmark, Search, Loader2, CheckCircle, X } from 'lucide-react';
import { User, Book } from '../../types';
import { firestoreService } from '../../src/services/firestoreService';
import { where, orderBy, QueryConstraint } from 'firebase/firestore';

interface ReservationsProps {
  user: User;
}

const Reservations: React.FC<ReservationsProps> = ({ user }) => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [dueDate, setDueDate] = useState('');
  const [fulfilling, setFulfilling] = useState(false);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('reservationDate', 'desc')];
    if (user.role !== 'admin' && user.role !== 'hod') {
      constraints.push(where('userId', '==', user.uid));
    }

    const unsubscribe = firestoreService.subscribeToCollection('reservations', constraints, async (data) => {
      // Enrich with book and user data
      const enriched = await Promise.all(data.map(async (res: any) => {
        const book = await firestoreService.getDoc<Book>('books', res.bookId);
        const member = await firestoreService.getDoc<User>('users', res.userId);
        let department = null;
        if (member?.departmentId) {
          department = await firestoreService.getDoc<any>('departments', member.departmentId);
        }
        return { ...res, book, user: member, department };
      }));
      
      let finalReservations = enriched;
      if (user.role === 'hod') {
        finalReservations = enriched.filter(r => r.user?.departmentId === user.departmentId);
      }
      
      setReservations(finalReservations);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation || !dueDate) return;
    
    setFulfilling(true);
    try {
      // Create issue record
      await firestoreService.addDoc('bookIssues', {
        bookId: selectedReservation.bookId,
        userId: selectedReservation.userId,
        issueDate: new Date().toISOString(),
        dueDate,
        status: 'issued',
        fineAmount: 0
      });

      // Update reservation status
      await firestoreService.updateDoc('reservations', selectedReservation.id, {
        status: 'fulfilled',
        fulfilledDate: new Date().toISOString()
      });

      // Decrement available copies
      const book = await firestoreService.getDoc<Book>('books', selectedReservation.bookId);
      if (book) {
        await firestoreService.updateDoc('books', selectedReservation.bookId, {
          availableCopies: (book.availableCopies || 0) - 1
        });
      }

      setShowFulfillModal(false);
      setSelectedReservation(null);
      setDueDate('');
    } catch (error) {
      console.error('Failed to fulfill reservation', error);
      alert('Failed to fulfill reservation');
    } finally {
      setFulfilling(false);
    }
  };

  const openFulfillModal = (reservation: any) => {
    setSelectedReservation(reservation);
    setShowFulfillModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reservations</h2>
          <p className="text-slate-500">Manage book reservations.</p>
        </div>
      </div>

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
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Reservation Date</th>
                  <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                  {user.role === 'admin' && (
                    <th className="p-4 text-sm font-semibold text-slate-900 dark:text-white text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {reservations.map(reservation => (
                  <tr key={reservation.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-slate-900 dark:text-white">{reservation.book?.title || 'Unknown Book'}</p>
                      <p className="text-xs text-slate-500 font-mono">{reservation.bookId}</p>
                    </td>
                    {(user.role === 'admin' || user.role === 'hod') && (
                      <td className="p-4">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{reservation.user?.name || 'Unknown User'}</p>
                        <p className="text-xs text-slate-500">{reservation.department?.name || 'No Department'}</p>
                      </td>
                    )}
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(reservation.reservationDate).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        reservation.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' :
                        reservation.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {reservation.status}
                      </span>
                    </td>
                    {user.role === 'admin' && (
                      <td className="p-4 text-right">
                        {reservation.status === 'pending' && (
                          <button 
                            onClick={() => openFulfillModal(reservation)}
                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                          >
                            Fulfill
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {reservations.length === 0 && (
                  <tr>
                    <td colSpan={user.role === 'admin' ? 5 : 4} className="p-8 text-center text-slate-500">
                      No reservations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fulfill Modal */}
      {showFulfillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Fulfill Reservation</h3>
              <button 
                onClick={() => {
                  setShowFulfillModal(false);
                  setSelectedReservation(null);
                }}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFulfill} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Fulfilling reservation for <strong>{selectedReservation?.book?.title || 'Unknown Book'}</strong> by <strong>{selectedReservation?.user?.name || 'Unknown User'}</strong>.
                </p>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Set Due Date</label>
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
                  onClick={() => {
                    setShowFulfillModal(false);
                    setSelectedReservation(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={fulfilling}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {fulfilling && <Loader2 className="w-4 h-4 animate-spin" />}
                  Fulfill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;
