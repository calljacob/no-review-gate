import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Filter, X, ChevronUp, ChevronDown, Search, Star } from 'lucide-react';
import StarRating from '../components/StarRating';

const CampaignReviews = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const campaignId = searchParams.get('campaignId');
    const campaignName = searchParams.get('campaignName') || 'Campaign';

    const [reviews, setReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter and sort state
    const [ratingFilter, setRatingFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');

    // Fetch reviews
    useEffect(() => {
        const fetchReviews = async () => {
            if (!campaignId) {
                setError('Campaign ID is required');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`/api/reviews?campaignId=${campaignId}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch reviews: ${response.statusText}`);
                }
                
                const data = await response.json();
                // Convert snake_case to camelCase
                const formattedReviews = data.map(review => ({
                    id: review.id,
                    leadId: review.lead_id,
                    campaignId: review.campaign_id,
                    rating: review.rating,
                    feedback: review.feedback || '',
                    createdAt: review.created_at
                }));
                
                setReviews(formattedReviews);
                setFilteredReviews(formattedReviews);
            } catch (err) {
                console.error('Error fetching reviews:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [campaignId]);

    // Apply filters and sorting
    useEffect(() => {
        let filtered = [...reviews];

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
    }, [reviews, ratingFilter, searchQuery, sortField, sortDirection]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const clearFilters = () => {
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

    const activeFiltersCount = (ratingFilter !== 'all' ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin')}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Back to campaigns"
                    >
                        <ArrowLeft size={20} className="text-slate-400" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            Reviews: {campaignName}
                        </h1>
                        <p className="text-slate-400 mt-1">
                            {filteredReviews.length} of {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                        </p>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
        </div>
    );
};

export default CampaignReviews;

