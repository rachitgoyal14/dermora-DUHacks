import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SkinLayersVisual from './SkinLayersVisual';
import { ArrowLeft, User, Mail, Phone, ArrowRight } from 'lucide-react';
import axios from 'axios';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const CompleteProfile: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone_number: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Call backend API
            const response = await axios.post(`${BACKEND_URL}/auth/register`, formData);

            if (response.status === 200) {
                // Store user info if needed
                navigate('/home');
            }
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#FFF5F5] font-sans text-skin-text flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center p-6">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 rounded-full hover:bg-black/5"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-md"
                >
                    <div className="text-center mb-8">
                        <div className="inline-block mb-4 transform scale-75">
                            <SkinLayersVisual size="sm" variant="clean" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-[#1A1A1A] mb-2">
                            Complete Your Profile
                        </h2>
                        <p className="text-[#5f6368]">
                            Tell us a bit about yourself to get started
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-[2rem] shadow-sm border border-black/5">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-500 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="full_name"
                                    required
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                                    placeholder="Jane Doe"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                                    placeholder="jane@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="tel"
                                    name="phone_number"
                                    required
                                    value={formData.phone_number}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                                    placeholder="+1 234 567 890"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-black text-white font-medium text-lg py-4 px-6 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-900 transition-colors mt-4 disabled:opacity-70"
                        >
                            <span>{loading ? 'Saving...' : 'Continue'}</span>
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
};

export default CompleteProfile;
