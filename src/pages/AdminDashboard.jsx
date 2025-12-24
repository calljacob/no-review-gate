import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, ExternalLink, Trash2, LayoutDashboard, Link as LinkIcon, LogOut, KeyRound, User, Upload, X, Star, Pencil } from 'lucide-react';

// Helper function to convert API response (snake_case) to frontend format (camelCase)
const toCamelCase = (apiCampaign) => ({
    id: apiCampaign.id,
    name: apiCampaign.name,
    googleLink: apiCampaign.google_link || '',
    yelpLink: apiCampaign.yelp_link || '',
    logoUrl: apiCampaign.logo_url || '',
    primaryColor: apiCampaign.primary_color || '',
    secondaryColor: apiCampaign.secondary_color || '',
    backgroundColor: apiCampaign.background_color || '',
    createdAt: apiCampaign.created_at
});

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCampaignId, setEditingCampaignId] = useState(null);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [user, setUser] = useState(null);
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        googleLink: '',
        yelpLink: '',
        logoUrl: '',
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        backgroundColor: '#0f172a',
        logoFile: null,
        logoPreview: null
    });
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Fetch user info and campaigns
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

        fetchUser();
        fetchCampaigns();
    }, []);

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file');
                return;
            }
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size must be less than 5MB');
                return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewCampaign({
                    ...newCampaign,
                    logoFile: file,
                    logoPreview: reader.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setNewCampaign({
            ...newCampaign,
            logoFile: null,
            logoPreview: null,
            logoUrl: ''
        });
    };

    const uploadLogo = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64 = reader.result;
                    const response = await fetch('/api/upload-logo', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            base64,
                            filename: file.name,
                            contentType: file.type,
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to upload logo');
                    }

                    const data = await response.json();
                    resolve(data.blobKey);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        try {
            setSubmitting(true);
            setError(null);
            
            // Upload logo first if there's a new file
            let logoUrl = newCampaign.logoUrl;
            if (newCampaign.logoFile) {
                setUploadingLogo(true);
                try {
                    const blobKey = await uploadLogo(newCampaign.logoFile);
                    logoUrl = blobKey;
                } catch (err) {
                    throw new Error(`Failed to upload logo: ${err.message}`);
                } finally {
                    setUploadingLogo(false);
                }
            }
            
            const isEditing = editingCampaignId !== null;
            const url = isEditing ? `/api/campaign?id=${editingCampaignId}` : '/api/campaigns';
            const method = isEditing ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newCampaign.name,
                    googleLink: newCampaign.googleLink || null,
                    yelpLink: newCampaign.yelpLink || null,
                    logoUrl: logoUrl || null,
                    primaryColor: newCampaign.primaryColor || null,
                    secondaryColor: newCampaign.secondaryColor || null,
                    backgroundColor: newCampaign.backgroundColor || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} campaign: ${response.statusText}`);
            }

            const savedCampaign = await response.json();
            const campaignCamelCase = toCamelCase(savedCampaign);

            if (isEditing) {
                // Update existing campaign in the list
                setCampaigns(campaigns.map(c => c.id === editingCampaignId ? campaignCamelCase : c));
                setEditingCampaignId(null);
            } else {
                // Add new campaign to the list
                setCampaigns([campaignCamelCase, ...campaigns]);
            }
            
            setNewCampaign({ 
                name: '', 
                googleLink: '', 
                yelpLink: '',
                logoUrl: '',
                primaryColor: '#6366f1',
                secondaryColor: '#8b5cf6',
                backgroundColor: '#0f172a',
                logoFile: null,
                logoPreview: null
            });
            setShowForm(false);
        } catch (err) {
            console.error(`Error ${editingCampaignId ? 'updating' : 'creating'} campaign:`, err);
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (campaign) => {
        setEditingCampaignId(campaign.id);
        setNewCampaign({
            name: campaign.name,
            googleLink: campaign.googleLink || '',
            yelpLink: campaign.yelpLink || '',
            logoUrl: campaign.logoUrl || '',
            primaryColor: campaign.primaryColor || '#6366f1',
            secondaryColor: campaign.secondaryColor || '#8b5cf6',
            backgroundColor: campaign.backgroundColor || '#0f172a',
            logoFile: null,
            logoPreview: campaign.logoUrl ? `/api/serve-logo?key=${campaign.logoUrl}` : null
        });
        setShowForm(true);
        setError(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingCampaignId(null);
        setNewCampaign({ 
            name: '', 
            googleLink: '', 
            yelpLink: '',
            logoUrl: '',
            primaryColor: '#6366f1',
            secondaryColor: '#8b5cf6',
            backgroundColor: '#0f172a',
            logoFile: null,
            logoPreview: null
        });
        setError(null);
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

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
            navigate('/login');
        } catch (err) {
            console.error('Logout error:', err);
            // Still navigate to login even if logout fails
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

    return (
        <div className="min-h-screen bg-slate-950 p-3 sm:p-4 md:p-6 lg:p-8 xl:p-12">
            <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-indigo-500/10 rounded-lg">
                                <LayoutDashboard className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-400" />
                            </div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">Campaigns</h1>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm pl-9 sm:pl-11 md:pl-[52px]">Manage your review campaigns and links</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 shadow-indigo-500/20"
                        >
                            <Plus size={16} className="sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">New Campaign</span>
                            <span className="sm:hidden">New</span>
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="p-2 sm:p-2.5 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                                title="User menu"
                            >
                                <User size={18} className="sm:w-5 sm:h-5" />
                            </button>
                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-48 sm:w-56 glass-panel p-2 space-y-1 z-50">
                                    {user && (
                                        <div className="px-3 py-2 text-xs sm:text-sm text-slate-400 border-b border-slate-700 truncate">
                                            {user.email}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setShowPasswordForm(true);
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <KeyRound size={14} className="sm:w-4 sm:h-4" />
                                        Change Password
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <LogOut size={14} className="sm:w-4 sm:h-4" />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="glass-panel p-3 sm:p-4 bg-red-500/10 border-red-500/30 text-red-400 rounded-xl">
                        <p className="font-medium text-xs sm:text-sm md:text-base">Error: {error}</p>
                    </div>
                )}

                {/* Add Campaign Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in overflow-y-auto">
                        <div className="glass-panel p-4 sm:p-6 md:p-8 w-full max-w-2xl space-y-4 sm:space-y-5 md:space-y-6 bg-slate-900 border-slate-700 shadow-2xl my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                {editingCampaignId ? 'Edit Campaign' : 'New Campaign'}
                            </h2>

                            <form onSubmit={handleSave} className="space-y-4 sm:space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">Campaign Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="input-field text-sm sm:text-base"
                                        value={newCampaign.name}
                                        onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                        placeholder="e.g. Summer Sale Follow-up"
                                    />
                                </div>

                                {/* Logo Upload */}
                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">Logo (Optional)</label>
                                    {newCampaign.logoPreview ? (
                                        <div className="relative inline-block">
                                            <img 
                                                src={newCampaign.logoPreview} 
                                                alt="Logo preview" 
                                                className="h-16 sm:h-20 object-contain rounded-lg border border-slate-700 bg-slate-800 p-2"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveLogo}
                                                className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                                            >
                                                <X size={14} className="sm:w-4 sm:h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-24 sm:h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-4 pb-4 sm:pt-5 sm:pb-6 px-4">
                                                <Upload className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-slate-400" />
                                                <p className="mb-1 sm:mb-2 text-xs sm:text-sm text-slate-400 text-center">
                                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-slate-500 text-center">PNG, JPG, GIF up to 5MB</p>
                                            </div>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={handleLogoChange}
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* Color Pickers */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs sm:text-sm font-medium text-slate-300">Primary Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="w-14 h-9 sm:w-16 sm:h-10 rounded border border-slate-700 cursor-pointer"
                                                value={newCampaign.primaryColor}
                                                onChange={e => setNewCampaign({ ...newCampaign, primaryColor: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 input-field text-xs sm:text-sm"
                                                value={newCampaign.primaryColor}
                                                onChange={e => setNewCampaign({ ...newCampaign, primaryColor: e.target.value })}
                                                placeholder="#6366f1"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-xs sm:text-sm font-medium text-slate-300">Secondary Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="w-14 h-9 sm:w-16 sm:h-10 rounded border border-slate-700 cursor-pointer"
                                                value={newCampaign.secondaryColor}
                                                onChange={e => setNewCampaign({ ...newCampaign, secondaryColor: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 input-field text-xs sm:text-sm"
                                                value={newCampaign.secondaryColor}
                                                onChange={e => setNewCampaign({ ...newCampaign, secondaryColor: e.target.value })}
                                                placeholder="#8b5cf6"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                                        <label className="block text-xs sm:text-sm font-medium text-slate-300">Background Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="w-14 h-9 sm:w-16 sm:h-10 rounded border border-slate-700 cursor-pointer"
                                                value={newCampaign.backgroundColor}
                                                onChange={e => setNewCampaign({ ...newCampaign, backgroundColor: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 input-field text-xs sm:text-sm"
                                                value={newCampaign.backgroundColor}
                                                onChange={e => setNewCampaign({ ...newCampaign, backgroundColor: e.target.value })}
                                                placeholder="#0f172a"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">Google Review Link</label>
                                    <input
                                        type="url"
                                        className="input-field text-sm sm:text-base"
                                        value={newCampaign.googleLink}
                                        onChange={e => setNewCampaign({ ...newCampaign, googleLink: e.target.value })}
                                        placeholder="https://g.page/..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">Yelp Review Link</label>
                                    <input
                                        type="url"
                                        className="input-field text-sm sm:text-base"
                                        value={newCampaign.yelpLink}
                                        onChange={e => setNewCampaign({ ...newCampaign, yelpLink: e.target.value })}
                                        placeholder="https://yelp.com/biz/..."
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="flex-1 px-4 py-2.5 sm:py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium text-sm sm:text-base"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 btn-primary text-sm sm:text-base py-2.5 sm:py-3"
                                        disabled={submitting || uploadingLogo}
                                    >
                                        {uploadingLogo 
                                            ? 'Uploading logo...' 
                                            : submitting 
                                                ? (editingCampaignId ? 'Updating...' : 'Creating...') 
                                                : (editingCampaignId ? 'Update' : 'Create')
                                        }
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Change Password Modal */}
                {showPasswordForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
                        <div className="glass-panel p-4 sm:p-6 md:p-8 w-full max-w-md space-y-4 sm:space-y-5 md:space-y-6 bg-slate-900 border-slate-700 shadow-2xl">
                            <h2 className="text-xl sm:text-2xl font-bold text-white">Change Password</h2>

                            <form onSubmit={handlePasswordChange} className="space-y-4 sm:space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">Current Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input-field text-sm sm:text-base"
                                        value={passwordData.currentPassword}
                                        onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        placeholder="Enter current password"
                                        autoComplete="current-password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input-field text-sm sm:text-base"
                                        value={passwordData.newPassword}
                                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="Enter new password (min 6 characters)"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs sm:text-sm font-medium text-slate-300">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="input-field text-sm sm:text-base"
                                        value={passwordData.confirmPassword}
                                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordForm(false);
                                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                            setError(null);
                                        }}
                                        className="flex-1 px-4 py-2.5 sm:py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium text-sm sm:text-base"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 btn-primary text-sm sm:text-base py-2.5 sm:py-3"
                                        disabled={changingPassword}
                                    >
                                        {changingPassword ? 'Changing...' : 'Change Password'}
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
                                    onClick={() => navigate(`/admin/reviews?campaignId=${campaign.id}&campaignName=${encodeURIComponent(campaign.name)}`)}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors border border-indigo-500/20 hover:border-indigo-500/30 flex items-center gap-2"
                                    title="View Reviews"
                                >
                                    <Star size={18} />
                                    <span className="hidden sm:inline">Reviews</span>
                                </button>

                                <button
                                    onClick={() => handleEdit(campaign)}
                                    className="w-full sm:w-auto p-2.5 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 rounded-lg transition-colors border border-transparent hover:border-blue-500/20"
                                    title="Edit Campaign"
                                >
                                    <Pencil size={20} className="mx-auto" />
                                </button>

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

export default AdminDashboard;
