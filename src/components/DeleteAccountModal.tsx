import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (confirmText.toLowerCase() !== 'delete my account') {
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmValid = confirmText.toLowerCase() === 'delete my account';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Delete Account
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-50"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                ⚠️ This action cannot be undone
              </h3>
              <p className="text-sm text-red-700">
                Deleting your account will permanently remove:
              </p>
              <ul className="mt-2 text-sm text-red-700 space-y-1 ml-4">
                <li>• Your profile and account information</li>
                <li>• All your resume analyses and history</li>
                <li>• Any tailored resumes and cover letters</li>
                <li>• All associated data and preferences</li>
              </ul>
            </div>

            <div>
              <label htmlFor="confirm-text" className="block text-sm font-medium text-gray-700 mb-2">
                To confirm deletion, type <strong>"delete my account"</strong> below:
              </label>
              <input
                id="confirm-text"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Type here..."
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmValid || isDeleting}
              className="flex-1 bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete My Account</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;