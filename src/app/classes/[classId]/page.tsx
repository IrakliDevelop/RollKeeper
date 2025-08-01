import { notFound } from 'next/navigation';
import { loadAllClasses } from '@/utils/classDataLoader';
import { getClassById } from '@/utils/classFilters';
import ClassDetailClient from '@/components/classes/ClassDetailClient';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

interface ClassDetailPageProps {
  params: Promise<{
    classId: string;
  }>;
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const { classId } = await params;
  
  // Load all classes and find the specific one
  const classes = await loadAllClasses();
  const classData = getClassById(classes, classId);
  
  if (!classData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-black opacity-40"></div>
        <div className="relative z-10 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Back Button */}
            <div className="mb-6">
              <Link 
                href="/classes"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white rounded-lg transition-all backdrop-blur-sm border border-slate-600/50 hover:border-slate-500/50"
              >
                <ArrowLeft size={16} />
                <span>Back to Classes</span>
              </Link>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border-2 border-emerald-500/30 rounded-lg flex items-center justify-center">
                  <Shield className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-6xl font-bold text-white">
                    {classData.name}
                  </h1>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <span className="text-emerald-400 font-medium">{classData.source}</span>
                    {classData.page && (
                      <span className="text-slate-400">Page {classData.page}</span>
                    )}
                    {classData.isSrd && (
                      <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm border border-emerald-500/30">
                        SRD
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                Explore the complete {classData.name} class with all features, subclasses, and progression details.
                {classData.subclasses.length > 0 && ` Choose from ${classData.subclasses.length} subclasses and compare their unique abilities.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <ClassDetailClient classData={classData} />
        </div>
      </div>
    </div>
  );
}

// Generate static params for all classes (optional optimization)
export async function generateStaticParams() {
  const classes = await loadAllClasses();
  
  return classes.map((classData) => ({
    classId: classData.id,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ClassDetailPageProps) {
  const { classId } = await params;
  const classes = await loadAllClasses();
  const classData = getClassById(classes, classId);
  
  if (!classData) {
    return {
      title: 'Class Not Found',
    };
  }

  return {
    title: `${classData.name} - D&D Class Details`,
    description: `Complete ${classData.name} class guide with features, subclasses, and progression. ${classData.subclasses.length} subclasses available.`,
  };
} 