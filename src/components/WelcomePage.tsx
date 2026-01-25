'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import {
  ArrowRight,
  Sparkles,
  Calculator,
  FileSpreadsheet,
  Brain,
  Shield,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomePageProps {
  onGetStarted: () => void;
}

export function WelcomePage({ onGetStarted }: WelcomePageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Extraction',
      description: 'Upload screenshots and let GPT-4 Vision automatically extract PD, LGD curves and loan data with high accuracy.',
      color: 'primary',
    },
    {
      icon: Calculator,
      title: 'Precise DCF Calculations',
      description: 'Industry-standard discounted cash flow analysis with support for multiple payment types and day count conventions.',
      color: 'accent',
    },
    {
      icon: FileSpreadsheet,
      title: 'Professional Excel Export',
      description: 'Generate detailed workbooks with summary sheets, cash flow schedules, and variance analysis.',
      color: 'warning',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Configure Forecasts',
      description: 'Upload PD & LGD forecast screenshots to extract probability curves',
    },
    {
      number: '02',
      title: 'Process Loans',
      description: 'Extract loan data from screenshots and run DCF calculations',
    },
    {
      number: '03',
      title: 'Export Results',
      description: 'Download comprehensive Excel reports with variance analysis',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/10 dark:bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent-400/10 dark:bg-accent-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-warning-400/10 dark:bg-warning-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-20">
          <div className={cn(
            'text-center space-y-6 transition-all duration-700',
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Powered by GPT-4 Vision</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              <span className="text-slate-900 dark:text-white">CECL DCF</span>
              <br />
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent">
                Testing Tool
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              AI-powered credit loss analysis for CECL compliance. Extract data from screenshots,
              run precise DCF calculations, and generate professional reports.
            </p>

            {/* CTA Button */}
            <div className="pt-4">
              <Button
                size="lg"
                onClick={onGetStarted}
                className="group px-8 py-4 text-lg shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all"
                icon={<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              >
                Get Started
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-6 pt-6 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent-500" />
                <span>CECL Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning-500" />
                <span>Real-time Analysis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-6xl mx-auto px-4 pb-16 md:pb-24">
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              const colorClasses = {
                primary: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
                accent: 'bg-accent-100 dark:bg-accent-900/50 text-accent-600 dark:text-accent-400',
                warning: 'bg-warning-100 dark:bg-warning-900/50 text-warning-600 dark:text-warning-400',
              };

              return (
                <div
                  key={idx}
                  className={cn(
                    'group bg-white dark:bg-slate-800/50 rounded-2xl p-6 shadow-soft dark:shadow-lg dark:shadow-slate-900/30',
                    'border border-slate-100 dark:border-slate-700/50',
                    'hover:shadow-lg hover:-translate-y-1 transition-all duration-300',
                    'transition-all delay-100',
                    mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  )}
                  style={{ transitionDelay: `${(idx + 1) * 100}ms` }}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                    colorClasses[feature.color as keyof typeof colorClasses]
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-white/50 dark:bg-slate-800/30 border-y border-slate-200 dark:border-slate-700/50">
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
            <div className={cn(
              'text-center mb-12 transition-all duration-700 delay-300',
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                How It Works
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Three simple steps to accurate credit loss calculations
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'relative transition-all duration-700',
                    mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  )}
                  style={{ transitionDelay: `${400 + idx * 100}ms` }}
                >
                  {/* Connector line */}
                  {idx < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary-200 to-transparent dark:from-primary-800" />
                  )}

                  <div className="relative text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xl font-bold mb-4 shadow-lg shadow-primary-500/30">
                      {step.number}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20 text-center">
          <div className={cn(
            'transition-all duration-700 delay-500',
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Ready to streamline your CECL analysis?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
              Start extracting data and running calculations in minutes, not hours.
            </p>
            <Button
              size="lg"
              onClick={onGetStarted}
              className="group px-8 py-4 text-lg"
              icon={<ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            >
              Begin Analysis
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700/50 py-6">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
            CECL DCF Testing Tool - Built for financial compliance professionals
          </div>
        </div>
      </div>
    </div>
  );
}
