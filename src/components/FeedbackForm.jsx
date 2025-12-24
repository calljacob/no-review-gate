import React, { useState } from 'react';
import { Send } from 'lucide-react';

const FeedbackForm = ({ onSubmit, isSubmitting = false }) => {
    const [feedback, setFeedback] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isSubmitting && feedback.trim()) {
            onSubmit(feedback);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">We value your feedback</h2>
                <p className="text-slate-400 leading-relaxed">
                    We're sorry we didn't meet your expectations. Please tell us how we can improve to earn a 5-star rating next time.
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="feedback" className="sr-only">Your Feedback</label>
                <textarea
                    id="feedback"
                    rows={4}
                    className="input-field resize-none min-h-[120px]"
                    placeholder="What could we have done better?"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    required
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting || !feedback.trim()}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
                {isSubmitting ? (
                    'Sending...'
                ) : (
                    <>
                        <span>Submit Feedback</span>
                        <Send className="w-4 h-4" />
                    </>
                )}
            </button>
        </form>
    );
};

export default FeedbackForm;
