import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import FeedbackForm from '../components/FeedbackForm';
import ExternalLinks from '../components/ExternalLinks';
import { MessageSquareHeart } from 'lucide-react';

const ReviewPage = () => {
    const [searchParams] = useSearchParams();
    const leadId = searchParams.get('leadid');
    const campaignId = searchParams.get('campaign');

    const [rating, setRating] = useState(0);
    const [step, setStep] = useState('rating'); // rating, feedback, links, done
    const [campaign, setCampaign] = useState(null);

    useEffect(() => {
        if (leadId && campaignId) {
            // Load campaign from localStorage
            const saved = localStorage.getItem('campaigns');
            if (saved) {
                const campaigns = JSON.parse(saved);
                const foundCampaign = campaigns.find(c => c.id === campaignId);
                if (foundCampaign) {
                    setCampaign(foundCampaign);
                }
            }
        }
    }, [leadId, campaignId]);

    const handleRate = (value) => {
        setRating(value);
        setTimeout(() => {
            if (value >= 4) {
                setStep('links');
            } else {
                setStep('feedback');
            }
        }, 400);
    };

    const handleFeedbackSubmit = (feedback) => {
        console.log('Feedback submitted:', { leadId, rating, feedback });
        setStep('done');
    };

    if (!leadId) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
                <div className="glass-panel p-8 text-center max-w-md w-full">
                    <p className="text-slate-400">Invalid link. Please check your URL.</p>
                </div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
                <div className="animate-pulse text-indigo-400 font-medium">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950"></div>

            {/* Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>

            <div className="relative z-10 w-full max-w-lg">
                <div className={`
                    p-8 md:p-12 space-y-8 transition-all duration-500
                    ${step === 'rating' ? 'bg-transparent' : 'glass-panel border-white/5 shadow-2xl shadow-black/50 backdrop-blur-2xl'}
                `}>

                    {/* Header */}
                    {step !== 'done' && (
                        <div className="text-center space-y-4 animate-fade-in">
                            {step !== 'rating' && (
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 mb-2 ring-1 ring-white/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                                    <MessageSquareHeart size={40} className="drop-shadow-lg" />
                                </div>
                            )}
                            <h1 className="text-4xl font-bold text-white tracking-tight">
                                {step === 'rating' ? 'How was your experience?' :
                                    step === 'feedback' ? 'We appreciate your feedback' :
                                        'Thank you!'}
                            </h1>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                {step === 'rating' ? 'Select a rating below' :
                                    step === 'feedback' ? 'Please let us know how we can improve.' :
                                        'Please share your experience on Google or Yelp.'}
                            </p>
                        </div>
                    )}

                    {/* Dynamic Content */}
                    <div className="min-h-[200px] flex items-center justify-center">
                        {step === 'rating' && (
                            <div className="w-full animate-slide-up">
                                <StarRating onRate={handleRate} />
                            </div>
                        )}

                        {step === 'feedback' && (
                            <div className="w-full animate-slide-up space-y-8">
                                <FeedbackForm onSubmit={handleFeedbackSubmit} />

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/10"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
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
                            <div className="text-center space-y-6 animate-fade-in py-8 w-full">
                                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                    <svg className="w-12 h-12 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-bold text-white">Thank You!</h2>
                                    <p className="text-slate-400 text-lg">
                                        Your feedback has been received and will help us improve.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-slate-600 text-sm font-medium tracking-wide uppercase">
                        Powered by ReviewCapture
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReviewPage;
