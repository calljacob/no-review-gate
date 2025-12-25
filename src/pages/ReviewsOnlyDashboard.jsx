import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, KeyRound, User, Star, Search, Filter, X, ChevronUp, ChevronDown } from 'lucide-react';
import StarRating from '../components/StarRating';

const ReviewsOnlyDashboard = () => {
    const navigate = useNavigate();
    const [reviews, setReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [user, setUser] = useState(null);
    
    // Filter and sort state
    const [ratingFilter, setRatingFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');
    
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Fetch user info
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/auth/verify', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                }
            } catch (err) {
                console.error('Error fetching user:', err);
            }
        };

        fetchUser();
    }, []);

    // Fetch campaigns and reviews
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Fetch campaigns
                const campaignsResponse = await fetch('/api/campaigns');
                if (!campaignsResponse.ok) {
                    throw new Error('Failed to fetch campaigns');
                }
                const campaignsData = await campaignsResponse.json();
                setCampaigns(campaignsData.map(c => ({
                    id: c.id,
                    name: c.name,
                    googleLink: c.google_link,
                    yelpLink: c.yelp_link
                })));

                // Fetch all reviews
                const reviewsResponse = await fetch('/api/reviews');
                if (!reviewsResponse.ok) {
                    throw new Error('Failed to fetch reviews');
                }
                const reviewsData = await reviewsResponse.json();
                const formattedReviews = reviewsData.map(review => ({
                    id: review.id,
                    leadId: review.lead_id,
                    campaignId: review.campaign_id,
                    rating: review.rating,
                    feedback: review.feedback || '',
                    createdAt: review.created_at
                }));
                setReviews(formattedReviews);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Apply filters and sorting
    useEffect(() => {
        let filtered = [...reviews];

        // Filter by campaign
        if (selectedCampaignId !== 'all') {
            filtered = filtered.filter(review => review.campaignId === parseInt(selectedCampaignId));
        }

        // Apply rating filter
        if (ratingFilter !== 'all') {
            const ratingValue = parseInt(ratingFilter);
            filtered = filtered.filter(review => review.rating === ratingValue);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(review => 
                review.feedback.toLowerCase().includes(query) ||
                review.leadId.toString().includes(query)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (sortField) {
                case 'created_at':
                    aValue = new Date(a.createdAt);
                    bValue = new Date(b.createdAt);
                    break;
                case 'rating':
                    aValue = a.rating;
                    bValue = b.rating;
                    break;
                case 'lead_id':
                    aValue = a.leadId;
                    bValue = b.leadId;
                    break;
                default:
                    aValue = a.createdAt;
                    bValue = b.createdAt;
            }

            if (sortField === 'created_at') {
                return sortDirection === 'asc' 
                    ? aValue - bValue 
                    : bValue - aValue;
            } else {
                return sortDirection === 'asc' 
                    ? (aValue > bValue ? 1 : -1)
                    : (aValue < bValue ? 1 : -1);
            }
        });

        setFilteredReviews(filtered);
    }, [reviews, selectedCampaignId, ratingFilter, searchQuery, sortField, sortDirection]);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
            navigate('/login');
        } catch (err) {
            console.error('Logout error:', err);
            navigate('/login');
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setError('New password must be at least 6 characters long');
            return;
        }

        try {
            setChangingPassword(true);
            setError(null);
            
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to change password');
            }

            alert('Password changed successfully!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setShowPasswordForm(false);
        } catch (err) {
            console.error('Error changing password:', err);
            setError(err.message);
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const clearFilters = () => {
        setSelectedCampaignId('all');
        setRatingFilter('all');
        setSearchQuery('');
        setSortField('created_at');
        setSortDirection('desc');
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSortIcon = (field) => {
        if (sortField !== field) {
            return null;
        }
        return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
    };

    const activeFiltersCount = (selectedCampaignId !== 'all' ? 1 : 0) + 
                               (ratingFilter !== 'all' ? 1 : 0) + 
                               (searchQuery.trim() ? 1 : 0);

    const getCampaignName = (campaignId) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        return campaign ? campaign.name : `Campaign #${campaignId}`;
    };

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <Star className="w-8 h-8 text-indigo-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Reviews</h1>
                        </div>
                        <p className="text-slate-400 pl-[52px]">View customer feedback and reviews</p>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="p-2.5 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                            title="User menu"
                        >
                            <User size={20} />
                        </button>
                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-56 glass-panel p-2 space-y-1 z-50">
                                {user && (
                                    <div className="px-3 py-2 text-sm text-slate-400 border-b border-slate-700">
                                        {user.email}
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        setShowPasswordForm(true);
                                        setShowUserMenu(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <KeyRound size={16} />
                                    Change Password
                                </button>
                                <button
                                    onClick={() => {
                                        handleLogout();
                                        setShowUserMenu(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="glass-panel p-4 bg-red-500/10 border-red-500/30 text-red-400 rounded-xl">
                        <p className="font-medium">Error: {error}</p>
                    </div>
                )}

                {/* Filters */}
                <div className="glass-panel p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Filter size={20} className="text-slate-400" />
                            <h2 className="text-lg font-semibold text-white">Filters</h2>
                            {activeFiltersCount > 0 && (
                                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">
                                    {activeFiltersCount} active
                                </span>
                            )}
                        </div>
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={16} />
                                Clear filters
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Campaign Filter */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Campaign</label>
                            <select
                                value={selectedCampaignId}
                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                className="input-field"
                            >
                                <option value="all">All Campaigns</option>
                                {campaigns.map(campaign => (
                                    <option key={campaign.id} value={campaign.id}>
                                        {campaign.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Rating Filter */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Rating</label>
                            <select
                                value={ratingFilter}
                                onChange={(e) => setRatingFilter(e.target.value)}
                                className="input-field"
                            >
                                <option value="all">All Ratings</option>
                                <option value="5">5 Stars</option>
                                <option value="4">4 Stars</option>
                                <option value="3">3 Stars</option>
                                <option value="2">2 Stars</option>
                                <option value="1">1 Star</option>
                            </select>
                        </div>

                        {/* Search Filter */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Search</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by feedback or lead ID..."
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reviews Table */}
                {loading ? (
                    <div className="text-center py-20 glass-panel border-dashed border-slate-800">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 text-slate-600 mb-4">
                            <Star size={32} className="animate-pulse" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading reviews...</h3>
                    </div>
                ) : filteredReviews.length === 0 ? (
                    <div className="text-center py-20 glass-panel border-dashed border-slate-800">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 text-slate-600 mb-4">
                            <Star size={32} />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                            {reviews.length === 0 ? 'No reviews yet' : 'No reviews match your filters'}
                        </h3>
                        <p className="text-slate-400">
                            {reviews.length === 0 
                                ? 'Reviews will appear here once customers submit feedback.'
                                : 'Try adjusting your filters to see more results.'}
                        </p>
                    </div>
                ) : (
                    <div className="glass-panel overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-800/50 border-b border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left">
                                            <button
                                                onClick={() => handleSort('created_at')}
                                                className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                                            >
                                                Date
                                                {getSortIcon('created_at')}
                                            </button>
                                        </th>
                                        <th className="px-6 py-4 text-left">
                                            <span className="text-sm font-semibold text-slate-300">Campaign</span>
                                        </th>
                                        <th className="px-6 py-4 text-left">
                                            <button
                                                onClick={() => handleSort('lead_id')}
                                                className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                                            >
                                                Lead ID
                                                {getSortIcon('lead_id')}
                                            </button>
                                        </th>
                                        <th className="px-6 py-4 text-left">
                                            <button
                                                onClick={() => handleSort('rating')}
                                                className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                                            >
                                                Rating
                                                {getSortIcon('rating')}
                                            </button>
                                        </th>
                                        <th className="px-6 py-4 text-left">
                                            <span className="text-sm font-semibold text-slate-300">Feedback</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {filteredReviews.map((review) => (
                                        <tr 
                                            key={review.id} 
                                            className="hover:bg-slate-800/30 transition-colors"
                                        >
                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                {formatDate(review.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                {getCampaignName(review.campaignId)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                                                {review.leadId}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <StarRating
                                                        initialRating={review.rating}
                                                        readOnly={true}
                                                        primaryColor="#facc15"
                                                        size="small"
                                                    />
                                                    <span className="text-sm text-slate-400">
                                                        ({review.rating}/5)
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-300 max-w-md">
                                                    {review.feedback || (
                                                        <span className="text-slate-500 italic">No feedback provided</span>
                                                    )}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Change Password Modal */}
                {showPasswordForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="glass-panel p-8 w-full max-w-md space-y-6 bg-slate-900 border-slate-700 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white">Change Password</h2>

                            <form onSubmit={handlePasswordChange} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Current Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input-field"
                                        value={passwordData.currentPassword}
                                        onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        placeholder="Enter current password"
                                        autoComplete="current-password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input-field"
                                        value={passwordData.newPassword}
                                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="Enter new password (min 6 characters)"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input-field"
                                        value={passwordData.confirmPassword}
                                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordForm(false);
                                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                            setError(null);
                                        }}
                                        className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 btn-primary"
                                        disabled={changingPassword}
                                    >
                                        {changingPassword ? 'Changing...' : 'Change Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            {/* Click outside to close user menu */}
            {showUserMenu && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                />
            )}
        </div>
    );
};

export default ReviewsOnlyDashboard;

