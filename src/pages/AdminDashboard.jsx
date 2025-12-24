import React, { useState, useEffect } from 'react';
import { Plus, Copy, ExternalLink, Trash2, LayoutDashboard, Link as LinkIcon } from 'lucide-react';

// Helper function to convert API response (snake_case) to frontend format (camelCase)
const toCamelCase = (apiCampaign) => ({
    id: apiCampaign.id,
    name: apiCampaign.name,
    googleLink: apiCampaign.google_link || '',
    yelpLink: apiCampaign.yelp_link || '',
    createdAt: apiCampaign.created_at
});

const AdminDashboard = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        googleLink: '',
        yelpLink: ''
    });

    // Fetch campaigns from API
    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch('/api/campaigns');
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
                }
                
                const data = await response.json();
                // Convert API response to camelCase for frontend
                setCampaigns(data.map(toCamelCase));
            } catch (err) {
                console.error('Error fetching campaigns:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCampaigns();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        
        try {
            setSubmitting(true);
            setError(null);
            
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newCampaign.name,
                    googleLink: newCampaign.googleLink || null,
                    yelpLink: newCampaign.yelpLink || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to create campaign: ${response.statusText}`);
            }

            const createdCampaign = await response.json();
            // Convert API response to camelCase and add to campaigns list
            setCampaigns([toCamelCase(createdCampaign), ...campaigns]);
            
            setNewCampaign({ name: '', googleLink: '', yelpLink: '' });
            setShowForm(false);
        } catch (err) {
            console.error('Error creating campaign:', err);
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this campaign?')) {
            return;
        }

        try {
            setError(null);
            const response = await fetch(`/api/campaign?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete campaign: ${response.statusText}`);
            }

            // Remove campaign from local state
            setCampaigns(campaigns.filter(c => c.id !== id));
        } catch (err) {
            console.error('Error deleting campaign:', err);
            setError(err.message);
            alert(`Failed to delete campaign: ${err.message}`);
        }
    };

    const generateLink = (campaignId) => {
        const baseUrl = window.location.origin;
        const randomLeadId = Math.floor(Math.random() * 100000);
        return `${baseUrl}/review?leadid=${randomLeadId}&campaign=${campaignId}`;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Link copied to clipboard!');
    };

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <LayoutDashboard className="w-8 h-8 text-indigo-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Campaigns</h1>
                        </div>
                        <p className="text-slate-400 pl-[52px]">Manage your review campaigns and links</p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-primary flex items-center gap-2 shadow-indigo-500/20"
                    >
                        <Plus size={20} />
                        New Campaign
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="glass-panel p-4 bg-red-500/10 border-red-500/30 text-red-400 rounded-xl">
                        <p className="font-medium">Error: {error}</p>
                    </div>
                )}

                {/* Add Campaign Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="glass-panel p-8 w-full max-w-md space-y-6 bg-slate-900 border-slate-700 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white">New Campaign</h2>

                            <form onSubmit={handleSave} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Campaign Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="input-field"
                                        value={newCampaign.name}
                                        onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                        placeholder="e.g. Summer Sale Follow-up"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Google Review Link</label>
                                    <input
                                        type="url"
                                        className="input-field"
                                        value={newCampaign.googleLink}
                                        onChange={e => setNewCampaign({ ...newCampaign, googleLink: e.target.value })}
                                        placeholder="https://g.page/..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Yelp Review Link</label>
                                    <input
                                        type="url"
                                        className="input-field"
                                        value={newCampaign.yelpLink}
                                        onChange={e => setNewCampaign({ ...newCampaign, yelpLink: e.target.value })}
                                        placeholder="https://yelp.com/biz/..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 btn-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Campaigns List */}
                {loading ? (
                    <div className="text-center py-20 glass-panel border-dashed border-slate-800">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 text-slate-600 mb-4">
                            <LayoutDashboard size={32} className="animate-pulse" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading campaigns...</h3>
                    </div>
                ) : (
                <div className="grid gap-4">
                    {campaigns.map(campaign => (
                        <div key={campaign.id} className="glass-panel p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:border-indigo-500/30 transition-colors group">
                            <div className="space-y-2 flex-1">
                                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                                    {campaign.name}
                                </h3>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${campaign.googleLink ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800'}`}>
                                        <ExternalLink size={14} />
                                        {campaign.googleLink ? 'Google Linked' : 'No Google Link'}
                                    </span>
                                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${campaign.yelpLink ? 'bg-red-500/10 text-red-400' : 'bg-slate-800'}`}>
                                        <ExternalLink size={14} />
                                        {campaign.yelpLink ? 'Yelp Linked' : 'No Yelp Link'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                <div className="flex-1 sm:flex-none relative w-full sm:w-auto group/input">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <LinkIcon size={14} />
                                    </div>
                                    <input
                                        readOnly
                                        value={generateLink(campaign.id)}
                                        className="w-full sm:w-80 pl-9 pr-10 py-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-slate-300 text-sm focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(generateLink(campaign.id))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                                        title="Copy Link"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => handleDelete(campaign.id)}
                                    className="w-full sm:w-auto p-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                    title="Delete Campaign"
                                >
                                    <Trash2 size={20} className="mx-auto" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {campaigns.length === 0 && (
                        <div className="text-center py-20 glass-panel border-dashed border-slate-800">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 text-slate-600 mb-4">
                                <LayoutDashboard size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">No campaigns yet</h3>
                            <p className="text-slate-400 max-w-sm mx-auto mb-6">
                                Create your first campaign to start collecting reviews from your customers.
                            </p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <Plus size={20} />
                                Create Campaign
                            </button>
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
