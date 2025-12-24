import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import FeedbackForm from '../components/FeedbackForm';
import ExternalLinks from '../components/ExternalLinks';
import { MessageSquareHeart } from 'lucide-react';

// Helper function to convert API response (snake_case) to frontend format (camelCase)
const toCamelCase = (apiCampaign) => ({
    id: apiCampaign.id,
    name: apiCampaign.name,
    googleLink: apiCampaign.google_link || '',
    yelpLink: apiCampaign.yelp_link || '',
    logoUrl: apiCampaign.logo_url || '',
    primaryColor: apiCampaign.primary_color || '#6366f1',
    secondaryColor: apiCampaign.secondary_color || '#8b5cf6',
    backgroundColor: apiCampaign.background_color || '#0f172a',
    createdAt: apiCampaign.created_at
});

const ReviewPage = () => {
    const [searchParams] = useSearchParams();
    const leadId = searchParams.get('leadid');
    const campaignId = searchParams.get('campaign');

    const [rating, setRating] = useState(0);
    const [step, setStep] = useState('rating'); // rating, feedback, links, done
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCampaign = async () => {
            if (!campaignId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await fetch(`/api/campaign?id=${campaignId}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch campaign: ${response.statusText}`);
                }
                
                const data = await response.json();
                setCampaign(toCamelCase(data));
            } catch (err) {
                console.error('Error fetching campaign:', err);
                setError(err.message || 'Failed to load campaign');
            } finally {
                setLoading(false);
            }
        };

        fetchCampaign();
    }, [campaignId]);

    const submitReview = async (ratingValue, feedback = null) => {
        if (!leadId || !campaignId) {
            setError('Missing required information');
            return false;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    leadId,
                    campaignId: parseInt(campaignId),
                    rating: ratingValue,
                    feedback: feedback || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit review');
            }

            const review = await response.json();
            console.log('Review submitted successfully:', review);
            return true;
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(err.message || 'Failed to submit review. Please try again.');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRate = async (value) => {
        setRating(value);
        
        // For positive ratings (4-5 stars), submit immediately
        // For negative ratings (1-3 stars), wait for feedback
        if (value >= 4) {
            const success = await submitReview(value);
            if (success) {
                setTimeout(() => {
                    setStep('links');
                }, 400);
            } else {
                // If submission failed, stay on rating step
                setRating(0);
            }
        } else {
            // For negative ratings, just move to feedback form
            // We'll submit when feedback is provided
            setTimeout(() => {
                setStep('feedback');
            }, 400);
        }
    };

    const handleFeedbackSubmit = async (feedback) => {
        // Submit the feedback (rating was already submitted, but we'll update it with feedback)
        const success = await submitReview(rating, feedback);
        
        if (success) {
            setStep('done');
        }
        // If it fails, error state is already set, user can try again
    };

    if (!leadId) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950">
                <div className="glass-panel p-6 sm:p-8 text-center max-w-md w-full">
                    <p className="text-slate-400 text-sm sm:text-base">Invalid link. Please check your URL.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
                <div className="animate-pulse font-medium text-sm sm:text-base" style={{ color: '#6366f1' }}>Loading...</div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: '#0f172a' }}>
                <div className="glass-panel p-6 sm:p-8 text-center max-w-md w-full">
                    <p className="text-slate-400 text-sm sm:text-base">{error || 'Campaign not found'}</p>
                </div>
            </div>
        );
    }

    // Convert hex colors to RGB for opacity support
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result 
            ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
            : '99, 102, 241'; // Default indigo
    };

    const primaryRgb = hexToRgb(campaign.primaryColor);
    const secondaryRgb = hexToRgb(campaign.secondaryColor);
    const logoUrl = campaign.logoUrl ? `/api/serve-logo?key=${campaign.logoUrl}` : null;

    return (
        <div 
            className="min-h-screen flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 relative overflow-hidden"
            style={{ backgroundColor: campaign.backgroundColor }}
        >
            {/* Background Elements */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div 
                className="absolute inset-0 bg-gradient-to-b"
                style={{
                    background: `linear-gradient(to bottom, rgba(${hexToRgb(campaign.backgroundColor)}, 0.8), rgba(${hexToRgb(campaign.backgroundColor)}, 0.9), ${campaign.backgroundColor})`
                }}
            ></div>

            {/* Decorative Blobs */}
            <div 
                className="absolute top-[-10%] left-[-10%] w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 rounded-full blur-3xl animate-pulse"
                style={{ backgroundColor: `rgba(${primaryRgb}, 0.3)` }}
            ></div>
            <div 
                className="absolute bottom-[-10%] right-[-10%] w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 rounded-full blur-3xl animate-pulse delay-1000"
                style={{ backgroundColor: `rgba(${secondaryRgb}, 0.3)` }}
            ></div>

            <div className="relative z-10 w-full max-w-lg px-2 sm:px-0">
                <div className={`
                    p-4 sm:p-6 md:p-8 lg:p-12 space-y-4 sm:space-y-6 md:space-y-8 transition-all duration-500
                    ${step === 'rating' ? 'bg-transparent' : 'glass-panel border-white/5 shadow-2xl shadow-black/50 backdrop-blur-2xl'}
                `}>

                    {/* Logo */}
                    {logoUrl && step === 'rating' && (
                        <div className="text-center mb-4 sm:mb-6 animate-fade-in">
                            <img 
                                src={logoUrl} 
                                alt="Logo" 
                                className="max-h-16 sm:max-h-20 md:max-h-24 max-w-full mx-auto object-contain"
                            />
                        </div>
                    )}

                    {/* Header */}
                    {step !== 'done' && (
                        <div className="text-center space-y-3 sm:space-y-4 animate-fade-in">
                            {step !== 'rating' && (
                                <div 
                                    className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-2 ring-1 ring-white/10"
                                    style={{
                                        background: `linear-gradient(to bottom right, rgba(${primaryRgb}, 0.2), rgba(${secondaryRgb}, 0.2))`,
                                        color: campaign.primaryColor,
                                        boxShadow: `0 0 30px rgba(${primaryRgb}, 0.2)`
                                    }}
                                >
                                    {logoUrl ? (
                                        <img 
                                            src={logoUrl} 
                                            alt="Logo" 
                                            className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                                        />
                                    ) : (
                                        <MessageSquareHeart size={32} className="sm:w-10 sm:h-10 drop-shadow-lg" />
                                    )}
                                </div>
                            )}
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight px-2">
                                {step === 'rating' ? 'How was your experience?' :
                                    step === 'feedback' ? 'We appreciate your feedback' :
                                        'Thank you!'}
                            </h1>
                            <p className="text-slate-400 text-base sm:text-lg leading-relaxed px-2 sm:px-0">
                                {step === 'rating' ? 'Select a rating below' :
                                    step === 'feedback' ? 'Please let us know how we can improve.' :
                                        'Please share your experience on Google or Yelp.'}
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs sm:text-sm animate-fade-in">
                            {error}
                        </div>
                    )}

                    {/* Dynamic Content */}
                    <div className="min-h-[150px] sm:min-h-[200px] flex items-center justify-center">
                        {step === 'rating' && (
                            <div className="w-full animate-slide-up">
                                <StarRating 
                                    onRate={handleRate} 
                                    disabled={isSubmitting}
                                    primaryColor={campaign.primaryColor}
                                />
                            </div>
                        )}

                        {step === 'feedback' && (
                            <div className="w-full animate-slide-up space-y-4 sm:space-y-6 md:space-y-8">
                                <FeedbackForm onSubmit={handleFeedbackSubmit} isSubmitting={isSubmitting} />

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/10"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs sm:text-sm">
                                        <span className="px-2 bg-slate-900 text-slate-500">Or leave a public review</span>
                                    </div>
                                </div>

                                <div className="opacity-80 hover:opacity-100 transition-opacity">
                                    <ExternalLinks
                                        googleLink={campaign.googleLink}
                                        yelpLink={campaign.yelpLink}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 'links' && (
                            <div className="w-full animate-slide-up">
                                <ExternalLinks
                                    googleLink={campaign.googleLink}
                                    yelpLink={campaign.yelpLink}
                                />
                            </div>
                        )}

                        {step === 'done' && (
                            <div className="text-center space-y-4 sm:space-y-6 animate-fade-in py-6 sm:py-8 w-full">
                                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                    <svg className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div className="space-y-2 px-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Thank You!</h2>
                                    <p className="text-slate-400 text-base sm:text-lg">
                                        Your feedback has been received and will help us improve.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="mt-4 sm:mt-6 md:mt-8 text-center">
                    <p className="text-slate-600 text-xs sm:text-sm font-medium tracking-wide uppercase">
                        Powered by ReviewCapture
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReviewPage;
