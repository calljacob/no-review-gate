import React, { useState } from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ onRate, initialRating = 0, readOnly = false, disabled = false }) => {
    const [hoverRating, setHoverRating] = useState(0);
    const [rating, setRating] = useState(initialRating);

    const handleMouseEnter = (index) => {
        if (!readOnly && !disabled) {
            setHoverRating(index);
        }
    };

    const handleMouseLeave = () => {
        if (!readOnly && !disabled) {
            setHoverRating(0);
        }
    };

    const handleClick = (index) => {
        if (!readOnly && !disabled) {
            setRating(index);
            if (onRate) {
                onRate(index);
            }
        }
    };

    return (
        <div className="flex gap-3 justify-center p-4">
            {[1, 2, 3, 4, 5].map((index) => {
                const isFilled = (hoverRating || rating) >= index;
                const isHovered = hoverRating >= index;

                return (
                    <button
                        key={index}
                        type="button"
                        disabled={disabled || readOnly}
                        className={`
              transition-all duration-300 transform focus:outline-none
              ${readOnly || disabled ? 'cursor-default opacity-50' : 'cursor-pointer hover:scale-125 active:scale-95'}
            `}
                        onMouseEnter={() => handleMouseEnter(index)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(index)}
                        aria-label={`Rate ${index} stars`}
                    >
                        <Star
                            size={48}
                            className={`
                ${isFilled ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-slate-600'}
                ${isHovered && !readOnly ? 'drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : ''}
                transition-all duration-300
              `}
                            strokeWidth={1.5}
                        />
                    </button>
                );
            })}
        </div>
    );
};

export default StarRating;
