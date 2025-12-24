import React, { useState } from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ onRate, initialRating = 0, readOnly = false, disabled = false, primaryColor, size = 'default' }) => {
    const [hoverRating, setHoverRating] = useState(0);
    const [rating, setRating] = useState(initialRating);
    
    // Size configurations: 'small', 'default', 'large'
    const sizeConfig = {
        small: {
            starSize: 14,
            starClass: 'w-3.5 h-3.5',
            gapClass: 'gap-1',
            paddingClass: 'p-0'
        },
        default: {
            starSize: 40,
            starClass: 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12',
            gapClass: 'gap-2 sm:gap-3',
            paddingClass: 'p-2 sm:p-4'
        },
        large: {
            starSize: 48,
            starClass: 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16',
            gapClass: 'gap-3 sm:gap-4',
            paddingClass: 'p-3 sm:p-5'
        }
    };
    
    const config = sizeConfig[size] || sizeConfig.default;

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
        <div className={`flex justify-center ${config.gapClass} ${config.paddingClass}`}>
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
                            size={config.starSize}
                            className={`
                ${config.starClass}
                ${isFilled ? '' : 'fill-transparent text-slate-600'}
                transition-all duration-300
              `}
                            style={isFilled ? {
                                fill: primaryColor || '#facc15',
                                color: primaryColor || '#facc15',
                                filter: isHovered && !readOnly ? `drop-shadow(0 0 10px ${primaryColor || '#facc15'}80)` : 'none'
                            } : {}}
                            strokeWidth={1.5}
                        />
                    </button>
                );
            })}
        </div>
    );
};

export default StarRating;
