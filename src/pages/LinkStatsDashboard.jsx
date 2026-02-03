import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarRange, MousePointerClick, Star, UserRound } from 'lucide-react';
import AppNavigation from '../components/AppNavigation';

const toInputDate = (date) => {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().split('T')[0];
};

const LinkStatsDashboard = () => {
    const [user, setUser] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [clicks, setClicks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedCampaignId, setSelectedCampaignId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const [userResponse, campaignsResponse, reviewsResponse, clicksResponse] = await Promise.all([
                    fetch('/api/auth/verify', { credentials: 'include' }),
                    fetch('/api/campaigns', { credentials: 'include' }),
                    fetch('/api/reviews', { credentials: 'include' }),
                    fetch('/api/link-clicks', { credentials: 'include' })
                ]);

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    setUser(userData.user || null);
                }

                if (!campaignsResponse.ok || !reviewsResponse.ok || !clicksResponse.ok) {
                    throw new Error('Failed to load link analytics data');
                }

                const [campaignsData, reviewsData, clicksData] = await Promise.all([
                    campaignsResponse.json(),
                    reviewsResponse.json(),
                    clicksResponse.json()
                ]);

                setCampaigns((campaignsData || []).map((c) => ({ id: c.id, name: c.name })));
                setReviews((reviewsData || []).map((r) => ({
                    id: r.id,
                    campaignId: r.campaign_id,
                    agent: (r.agent || '').trim() || 'Unassigned',
                    rating: Number(r.rating),
                    createdAt: r.created_at
                })));
                setClicks((clicksData || []).map((c) => ({
                    id: c.id,
                    campaignId: c.campaign_id,
                    reviewId: c.review_id,
                    agent: (c.agent || '').trim(),
                    buttonType: c.button_type,
                    createdAt: c.created_at
                })));
            } catch (err) {
                console.error('Error loading link stats:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const inDateRange = (dateString) => {
        const date = new Date(dateString);
        if (startDate) {
            const start = new Date(`${startDate}T00:00:00`);
            if (date < start) return false;
        }
        if (endDate) {
            const end = new Date(`${endDate}T23:59:59.999`);
            if (date > end) return false;
        }
        return true;
    };

    const reviewLookup = useMemo(() => {
        const map = new Map();
        reviews.forEach((review) => map.set(review.id, review));
        return map;
    }, [reviews]);

    const filteredReviews = useMemo(() => {
        return reviews.filter((review) => {
            const campaignMatch = selectedCampaignId === 'all' || review.campaignId === Number(selectedCampaignId);
            return campaignMatch && inDateRange(review.createdAt);
        });
    }, [reviews, selectedCampaignId, startDate, endDate]);

    const filteredClicks = useMemo(() => {
        return clicks.filter((click) => {
            const campaignMatch = selectedCampaignId === 'all' || click.campaignId === Number(selectedCampaignId);
            return campaignMatch && inDateRange(click.createdAt);
        });
    }, [clicks, selectedCampaignId, startDate, endDate]);

    const reviewsByAgent = useMemo(() => {
        const counts = new Map();
        filteredReviews.forEach((review) => {
            counts.set(review.agent, (counts.get(review.agent) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([agent, count]) => ({ agent, count }))
            .sort((a, b) => b.count - a.count);
    }, [filteredReviews]);

    const averageScoreByAgent = useMemo(() => {
        const totals = new Map();
        filteredReviews.forEach((review) => {
            const current = totals.get(review.agent) || { total: 0, count: 0 };
            totals.set(review.agent, { total: current.total + review.rating, count: current.count + 1 });
        });
        return Array.from(totals.entries())
            .map(([agent, values]) => ({
                agent,
                average: values.count ? values.total / values.count : 0,
                count: values.count
            }))
            .sort((a, b) => b.average - a.average);
    }, [filteredReviews]);

    const platformClicksByAgent = useMemo(() => {
        const totals = new Map();
        filteredClicks.forEach((click) => {
            const review = click.reviewId ? reviewLookup.get(click.reviewId) : null;
            const agent = (click.agent || review?.agent || 'Unassigned').trim() || 'Unassigned';
            const current = totals.get(agent) || { google: 0, yelp: 0, total: 0 };
            if (click.buttonType === 'google') current.google += 1;
            if (click.buttonType === 'yelp') current.yelp += 1;
            current.total += 1;
            totals.set(agent, current);
        });
        return Array.from(totals.entries())
            .map(([agent, value]) => ({ agent, ...value }))
            .sort((a, b) => b.total - a.total);
    }, [filteredClicks, reviewLookup]);

    const reviewsByScore = useMemo(() => {
        const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        filteredReviews.forEach((review) => {
            if (buckets[review.rating] !== undefined) {
                buckets[review.rating] += 1;
            }
        });
        return buckets;
    }, [filteredReviews]);

    const topReviewsAgent = reviewsByAgent[0] || { agent: 'N/A', count: 0 };
    const topAverageAgent = averageScoreByAgent[0] || { agent: 'N/A', average: 0, count: 0 };
    const topPlatformClicks = platformClicksByAgent[0] || { agent: 'N/A', total: 0, google: 0, yelp: 0 };
    const maxScoreCount = Math.max(...Object.values(reviewsByScore), 1);

    const applyPreset = (days) => {
        if (days === 'all') {
            setStartDate('');
            setEndDate('');
            return;
        }
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - days + 1);
        setStartDate(toInputDate(start));
        setEndDate(toInputDate(today));
    };

    return (
        <div className="min-h-screen bg-slate-950 p-3 sm:p-4 md:p-6 lg:p-8 xl:p-12">
            <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
                <AppNavigation userRole={user?.role} />

                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <BarChart3 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Link Stats</h1>
                    </div>
                    <p className="text-slate-400 text-sm sm:text-base">Track review and click performance by agent and platform.</p>
                </div>

                {error && (
                    <div className="glass-panel p-4 bg-red-500/10 border-red-500/30 text-red-400 rounded-xl">
                        {error}
                    </div>
                )}

                <div className="glass-panel p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                        <CalendarRange size={16} />
                        Filters
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select
                            className="input-field text-sm"
                            value={selectedCampaignId}
                            onChange={(e) => setSelectedCampaignId(e.target.value)}
                        >
                            <option value="all">All Campaigns</option>
                            {campaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                    {campaign.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            className="input-field text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <input
                            type="date"
                            className="input-field text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <button
                            onClick={() => {
                                setSelectedCampaignId('all');
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                        >
                            Clear Filters
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => applyPreset(7)} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs">Last 7 days</button>
                        <button onClick={() => applyPreset(30)} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs">Last 30 days</button>
                        <button onClick={() => applyPreset(90)} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs">Last 90 days</button>
                        <button onClick={() => applyPreset('all')} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs">All time</button>
                    </div>
                </div>

                {loading ? (
                    <div className="glass-panel p-10 text-center text-slate-400">Loading analytics...</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="glass-panel p-5 space-y-3">
                            <div className="flex items-center gap-2 text-slate-300">
                                <UserRound size={16} />
                                <h2 className="font-semibold">Most Reviews by Agent</h2>
                            </div>
                            <div className="text-2xl font-bold text-white">{topReviewsAgent.agent}</div>
                            <div className="text-slate-400 text-sm">{topReviewsAgent.count} reviews</div>
                            <div className="space-y-1 pt-2">
                                {reviewsByAgent.slice(0, 5).map((row) => (
                                    <div key={row.agent} className="flex justify-between text-sm">
                                        <span className="text-slate-300">{row.agent}</span>
                                        <span className="text-slate-400">{row.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel p-5 space-y-3">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Star size={16} />
                                <h2 className="font-semibold">Average Review Score by Agent</h2>
                            </div>
                            <div className="text-2xl font-bold text-white">{topAverageAgent.agent}</div>
                            <div className="text-slate-400 text-sm">
                                {topAverageAgent.average.toFixed(2)} avg ({topAverageAgent.count} reviews)
                            </div>
                            <div className="space-y-1 pt-2">
                                {averageScoreByAgent.slice(0, 5).map((row) => (
                                    <div key={row.agent} className="flex justify-between text-sm">
                                        <span className="text-slate-300">{row.agent}</span>
                                        <span className="text-slate-400">{row.average.toFixed(2)} ({row.count})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel p-5 space-y-3">
                            <div className="flex items-center gap-2 text-slate-300">
                                <MousePointerClick size={16} />
                                <h2 className="font-semibold">Most Platform Clicks by Agent</h2>
                            </div>
                            <div className="text-2xl font-bold text-white">{topPlatformClicks.agent}</div>
                            <div className="text-slate-400 text-sm">
                                {topPlatformClicks.total} clicks (Google {topPlatformClicks.google} / Yelp {topPlatformClicks.yelp})
                            </div>
                            <div className="space-y-1 pt-2">
                                {platformClicksByAgent.slice(0, 5).map((row) => (
                                    <div key={row.agent} className="flex justify-between text-sm">
                                        <span className="text-slate-300">{row.agent}</span>
                                        <span className="text-slate-400">{row.total} ({row.google}/{row.yelp})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel p-5 space-y-3">
                            <div className="flex items-center gap-2 text-slate-300">
                                <BarChart3 size={16} />
                                <h2 className="font-semibold">Number of Reviews by Score</h2>
                            </div>
                            <div className="space-y-2 pt-1">
                                {[5, 4, 3, 2, 1].map((score) => (
                                    <div key={score} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-300">{score} stars</span>
                                            <span className="text-slate-400">{reviewsByScore[score]}</span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-2">
                                            <div
                                                className="bg-indigo-500 h-2 rounded-full transition-all"
                                                style={{ width: `${(reviewsByScore[score] / maxScoreCount) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LinkStatsDashboard;
