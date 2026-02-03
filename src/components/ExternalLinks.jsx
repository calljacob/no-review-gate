import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

const ExternalLinks = ({ googleLink, yelpLink, campaignId, leadId, projectId, agent, reviewId, compact = false }) => {
    // Construct Google review URL from Place ID
    const googleReviewUrl = googleLink ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googleLink)}` : null;

    const trackClick = (buttonType, targetUrl) => {
        const payload = {
            campaignId: campaignId ? parseInt(campaignId, 10) : null,
            reviewId: reviewId ? parseInt(reviewId, 10) : null,
            leadId: leadId || null,
            projectId: projectId || null,
            agent: agent || null,
            buttonType,
            targetUrl
        };

        if (!payload.campaignId) return;

        const body = JSON.stringify(payload);

        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon('/api/link-clicks', blob);
            return;
        }

        fetch('/api/link-clicks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        }).catch((err) => {
            console.error('Failed to track link click:', err);
        });
    };
    
    const linkContainerClasses = compact
        ? 'flex flex-wrap items-center justify-center gap-x-6 gap-y-2'
        : 'grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2';

    const linkClasses = compact
        ? 'inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 hover:text-white underline underline-offset-2 transition-colors'
        : 'flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 text-white rounded-xl border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 group';

    const iconClasses = compact
        ? 'w-3.5 h-3.5 sm:w-4 sm:h-4'
        : 'w-5 h-5 sm:w-6 sm:h-6 text-white';

    const externalIconClasses = compact
        ? 'w-3 h-3 opacity-80'
        : 'w-3 h-3 sm:w-4 sm:h-4 opacity-90 group-hover:opacity-100 transition-opacity ml-auto';

    return (
        <div className="w-full animate-fade-in">
            <div className={linkContainerClasses}>
                {googleReviewUrl && (
                    <a
                        href={googleReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackClick('google', googleReviewUrl)}
                        className={`${linkClasses} ${compact ? '' : 'bg-[#174EA6] hover:bg-[#123B80]'}`}
                    >
                        {!compact && (
                            <div className="p-1.5 sm:p-2 bg-white/20 rounded-full">
                                <MapPin className={iconClasses} />
                            </div>
                        )}
                        <span className={compact ? '' : 'font-bold text-base sm:text-lg'}>Google</span>
                        <ExternalLink className={externalIconClasses} />
                    </a>
                )}

                {yelpLink && (
                    <a
                        href={yelpLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackClick('yelp', yelpLink)}
                        className={`${linkClasses} ${compact ? '' : 'bg-[#B91C1C] hover:bg-[#991B1B]'}`}
                    >
                        {!compact && (
                            <div className="p-1.5 sm:p-2 bg-white/20 rounded-full">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                                    <path d="M20.18 10.16c.74.2 1.52.4 2.3.62.4.1.78.5.7 1.02-.08.5-.5.8-1 .88-1.5.25-3 .5-4.5.75-.2.03-.4.06-.6.1-.52.1-1.04.2-1.6.3l.12-1.6c.1-1.3.2-2.6.3-3.9.03-.4.4-.72.8-.77.5-.06 1 .2 1.16.66.44 1.3.88 2.6 1.32 3.9zm-7.86 2.2c.26 1.5.52 3 .78 4.5.05.3-.1.6-.35.8-.25.2-.56.2-.8.03-.9-.63-1.8-1.26-2.7-1.9-.15-.1-.3-.2-.46-.3l1.1-1.15c.92-.96 1.84-1.92 2.76-2.88.3-.3.7-.36 1.03-.16.33.2.4.6.27.96-.54 1.5-1.08 3-1.63 4.5zm-3.6-4.1c1.07.9 2.14 1.8 3.2 2.7l-1.5.5c-1.3.44-2.6.88-3.9 1.32-.3.1-.67-.04-.87-.3-.2-.24-.17-.58.05-.84 1.02-1.2 2.04-2.4 3.06-3.6.1-.12.2-.24.3-.36l1.3.2c1.2.18 2.4.36 3.6.54.4.06.65.4.6.8-.06.4-.4.65-.8.7-1.2-.18-2.4-.36-3.6-.54zm-1.2 8.3c.67-1.34 1.34-2.68 2-4.02l.8 1.45c.4 1.3.8 2.6 1.2 3.9.1.32-.05.68-.35.86-.3.18-.66.13-.9-.13-.9-1-1.8-2-2.7-3-.1-.1-.2-.2-.3-.3l-.6 1.3c-.54 1.2-1.08 2.4-1.62 3.6-.16.36-.53.54-.9.42-.37-.1-.55-.48-.4-.84.6-1.34 1.2-2.68 1.8-4.02z" />
                                </svg>
                            </div>
                        )}
                        <span className={compact ? '' : 'font-bold text-base sm:text-lg'}>Yelp</span>
                        <ExternalLink className={externalIconClasses} />
                    </a>
                )}
            </div>
        </div>
    );
};

export default ExternalLinks;
