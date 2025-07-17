import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { User, Mail, MapPin, Camera, Clock, FileText, Eye, Loader2, TrendingUp, MoreVertical, ArrowRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DeleteAccountModal from '../components/DeleteAccountModal';

interface ResumeAnalysis {
  id: string;
  user_id: string;
  compatibility_score: number;
  keyword_matches: string[];
  experience_gaps: string[];
  tailored_resume?: string;
  cover_letter?: string;
  analysis_details?: any;
  original_resume_text?: string;
  original_job_description?: string;
  created_at: string;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  hasMore: boolean;
  totalCount: number;
}

const Account: React.FC = () => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resumeHistory, setResumeHistory] = useState<ResumeAnalysis[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 0,
    itemsPerPage: 10,
    hasMore: true,
    totalCount: 0
  });
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    address: '',
    profile_picture_url: ''
  });
  
  const { user, userProfile, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdownId]);

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        address: userProfile.address || '',
        profile_picture_url: userProfile.profile_picture_url || ''
      });
    }
  }, [userProfile]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchResumeHistory(true); // Reset pagination when switching to history tab
    }
  }, [activeTab]);

  const fetchResumeHistory = async (reset: boolean = false) => {
    if (!user) return;

    if (reset) {
      setIsLoading(true);
      setResumeHistory([]);
      setPagination(prev => ({ ...prev, currentPage: 0, hasMore: true }));
    } else {
      setIsLoadingMore(true);
    }

    try {
      const startIndex = reset ? 0 : pagination.currentPage * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage - 1;

      // Fetch one extra item to check if there are more
      const { data, error } = await supabase
        .from('resume_analyses')
        .select('id, user_id, compatibility_score, keyword_matches, experience_gaps, tailored_resume, cover_letter, analysis_details, original_resume_text, original_job_description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex + 1); // Fetch one extra to check for more

      if (error) throw error;
      
      const items = data || [];
      const hasMore = items.length > pagination.itemsPerPage;
      const actualItems = hasMore ? items.slice(0, pagination.itemsPerPage) : items;

      if (reset) {
        setResumeHistory(actualItems);
      } else {
        setResumeHistory(prev => [...prev, ...actualItems]);
      }

      setPagination(prev => ({
        ...prev,
        currentPage: reset ? 1 : prev.currentPage + 1,
        hasMore,
        totalCount: reset ? actualItems.length : prev.totalCount + actualItems.length
      }));

    } catch (err) {
      showToast('Failed to load resume history', 'error');
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && pagination.hasMore) {
      fetchResumeHistory(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: profileData.name || null,
          address: profileData.address || null,
          profile_picture_url: profileData.profile_picture_url || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUserProfile();
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Call the delete-user Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }

      // Account deleted successfully
      showToast('Account deleted successfully', 'success');
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate('/login', { state: { message: 'account_deleted' } });
      
    } catch (error) {
      console.error('Error deleting account:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to delete account. Please try again.',
        'error'
      );
    } finally {
      setShowDeleteModal(false);
    }
  };
  const handleViewResume = (analysis: ResumeAnalysis) => {
    setOpenDropdownId(null); // Close dropdown
    if (analysis.tailored_resume && analysis.tailored_resume.trim()) {
      // Navigate to success page with tailored resume
      navigate('/success', {
        state: {
          tailoredResume: analysis.tailored_resume,
          improvements: ['Previously generated resume from your history'],
          coverLetter: analysis.cover_letter,
          coverLetterKeyPoints: analysis.cover_letter ? ['Previously generated cover letter from your history'] : null,
          reference: `history-${analysis.id}`
        }
      });
    } else if (analysis.analysis_details) {
      // Navigate to dashboard with analysis details
      navigate('/dashboard', {
        state: {
          initialAnalysisResult: analysis.analysis_details,
          originalResumeText: analysis.original_resume_text,
          originalJobDescription: analysis.original_job_description,
          fromHistory: true
        }
      });
    } else {
      // Fallback: navigate to dashboard with basic analysis info
      navigate('/dashboard', {
        state: {
          initialAnalysisResult: {
            match_summary: "This is a historical analysis from your account.",
            match_score: `${analysis.compatibility_score}/100`,
            job_keywords_detected: analysis.keyword_matches.map(keyword => ({
              keyword,
              status: 'Present' as const
            })),
            gaps_and_suggestions: analysis.experience_gaps || []
          },
          originalResumeText: analysis.original_resume_text,
          originalJobDescription: analysis.original_job_description,
          fromHistory: true
        }
      });
    }
  };

  const handleUpgradeAnalysis = (analysis: ResumeAnalysis) => {
    setOpenDropdownId(null); // Close dropdown
    if (analysis.original_resume_text && analysis.original_job_description) {
      // Navigate to premium page with original texts and analysis
      navigate('/premium', {
        state: {
          resumeText: analysis.original_resume_text,
          jobDescription: analysis.original_job_description,
          analysisResult: analysis.analysis_details || {
            match_summary: "Historical analysis from your account.",
            match_score: `${analysis.compatibility_score}/100`,
            job_keywords_detected: analysis.keyword_matches.map(keyword => ({
              keyword,
              status: 'Present' as const
            })),
            gaps_and_suggestions: analysis.experience_gaps || []
          }
        }
      });
    }
  };

  const toggleDropdown = (analysisId: string) => {
    setOpenDropdownId(openDropdownId === analysisId ? null : analysisId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysRemaining = (dateString: string) => {
    const createdDate = new Date(dateString);
    const expiryDate = new Date(createdDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysRemaining);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Account Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your profile and view your resume history</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 sm:mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Resume History
            </button>
          </nav>
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Profile Information</h2>
          
          <form onSubmit={handleProfileUpdate} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <input
                    type="text"
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    value={profileData.email}
                    disabled
                    className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 text-sm sm:text-base"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <textarea
                  id="address"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  rows={3}
                  className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="Enter your address"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile_picture_url" className="block text-sm font-medium text-gray-700 mb-1">
                Profile Picture URL
              </label>
              <div className="relative">
                <Camera className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <input
                  type="url"
                  id="profile_picture_url"
                  value={profileData.profile_picture_url}
                  onChange={(e) => setProfileData({ ...profileData, profile_picture_url: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="https://example.com/your-photo.jpg"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              {/* Delete Account Section */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full sm:w-auto">
                <h3 className="text-sm font-semibold text-red-800 mb-2">Danger Zone</h3>
                <p className="text-xs text-red-700 mb-3">
                  Permanently delete your account and all associated data.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center space-x-2 text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Account</span>
                </button>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Resume History</h2>
          </div>
          
          {/* Added text directly under Resume History heading */}
          <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-500">
            <div>Resumes are saved for 30 days</div>
            <div className="mt-1">Showing {resumeHistory.length} {pagination.hasMore ? 'of many' : 'total'}</div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-600">Loading your resume history...</p>
            </div>
          ) : resumeHistory.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resume History</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                You haven't generated any tailored resumes yet.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                Analyze Your First Resume
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {resumeHistory.map((analysis) => {
                const daysRemaining = getDaysRemaining(analysis.created_at);
                const isExpired = daysRemaining === 0;
                const hasContent = analysis.tailored_resume || analysis.analysis_details;
                const canUpgrade = analysis.original_resume_text && analysis.original_job_description && !analysis.tailored_resume && !isExpired;
                
                return (
                  <div
                    key={analysis.id}
                    className={`border rounded-lg p-4 sm:p-6 transition-all duration-200 ${
                      isExpired 
                        ? 'border-red-200 bg-red-50' 
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Mobile: Title and ellipsis on same line */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 sm:w-3 sm:h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-sm sm:text-base font-medium text-gray-900">
                              Resume Analysis
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 flex items-center space-x-1">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{formatDate(analysis.created_at)}</span>
                          </div>
                        </div>
                        
                        {/* Ellipsis button - always visible on mobile */}
                        <div className="relative" ref={openDropdownId === analysis.id ? dropdownRef : null}>
                          <button
                            onClick={() => toggleDropdown(analysis.id)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                          </button>
                          
                          {openDropdownId === analysis.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <div className="py-1">
                                {hasContent && !isExpired ? (
                                  <button
                                    onClick={() => handleViewResume(analysis)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                  >
                                    <Eye className="h-4 w-4 text-blue-600" />
                                    <span>
                                      {analysis.tailored_resume ? 'View Tailored Resume' : 'View Analysis Details'}
                                    </span>
                                  </button>
                                ) : null}
                                
                                {canUpgrade ? (
                                  <button
                                    onClick={() => handleUpgradeAnalysis(analysis)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                  >
                                    <TrendingUp className="h-4 w-4 text-orange-600" />
                                    <span>Get Tailored Resume</span>
                                  </button>
                                ) : null}
                                
                                {!hasContent && !canUpgrade ? (
                                  <div className="px-4 py-2 text-sm text-gray-500">
                                    {isExpired ? 'Content expired' : 'No actions available'}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Stats grid - responsive layout */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-500">Score:</span>
                          <span className="ml-1 font-medium text-gray-900">
                            {analysis.compatibility_score}/100
                          </span>
                        </div>
                        {/* Hide Keywords on mobile, show on sm and up */}
                        <div className="hidden sm:block">
                          <span className="text-gray-500">Keywords:</span>
                          <span className="ml-1 font-medium text-gray-900">
                            {analysis.keyword_matches.length}
                          </span>
                        </div>
                        <div className="col-span-1 sm:col-span-1">
                          <span className="text-gray-500">Expires in:</span>
                          <span className={`ml-1 font-medium ${
                            isExpired ? 'text-red-600' : daysRemaining <= 7 ? 'text-orange-600' : 'text-gray-900'
                          }`}>
                            {isExpired ? 'Expired' : `${daysRemaining} days`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {!isLoading && resumeHistory.length > 0 && pagination.hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 mx-auto text-sm sm:text-base"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <>
                    <span>Load More</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* End of Results Message */}
          {!isLoading && resumeHistory.length > 0 && !pagination.hasMore && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 py-4">
                Opps! Nothing more to show.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
};

export default Account;

