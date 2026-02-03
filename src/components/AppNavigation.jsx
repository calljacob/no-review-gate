import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, ChevronRight, LayoutDashboard, Star } from 'lucide-react';

const navigationItems = [
    { to: '/admin', label: 'Campaigns', icon: LayoutDashboard, adminOnly: true },
    { to: '/reviews', label: 'All Reviews', icon: Star, adminOnly: false },
    { to: '/link-stats', label: 'Link Stats', icon: BarChart3, adminOnly: false },
];

const AppNavigation = ({ userRole, currentLabel = null }) => {
    const visibleItems = navigationItems.filter(item => !item.adminOnly || userRole === 'admin');

    return (
        <nav className="glass-panel px-3 py-2 sm:px-4 sm:py-3 border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
                {visibleItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent'
                                }`
                            }
                        >
                            <Icon size={16} />
                            {item.label}
                        </NavLink>
                    );
                })}

                {currentLabel && (
                    <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 ml-1">
                        <ChevronRight size={14} />
                        <span>{currentLabel}</span>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default AppNavigation;
