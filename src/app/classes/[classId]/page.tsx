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

export default async function ClassDetailPage({
  params,
}: ClassDetailPageProps) {
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
          <div className="mx-auto max-w-7xl">
            {/* Back Button */}
            <div className="mb-6">
              <Link
                href="/classes"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-800/60 px-4 py-2 text-slate-300 backdrop-blur-sm transition-all hover:border-slate-500/50 hover:bg-slate-700/60 hover:text-white"
              >
                <ArrowLeft size={16} />
                <span>Back to Classes</span>
              </Link>
            </div>

            <div className="text-center">
              <div className="mb-6 flex items-center justify-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 to-emerald-800/20">
                  <Shield className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white md:text-6xl">
                    {classData.name}
                  </h1>
                  <div className="mt-2 flex items-center justify-center gap-4">
                    <span className="font-medium text-emerald-400">
                      {classData.source}
                    </span>
                    {classData.page && (
                      <span className="text-slate-400">
                        Page {classData.page}
                      </span>
                    )}
                    {classData.isSrd && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-sm text-emerald-400">
                        SRD
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="mx-auto max-w-3xl text-xl text-slate-300">
                Explore the complete {classData.name} class with all features,
                subclasses, and progression details.
                {classData.subclasses.length > 0 &&
                  ` Choose from ${classData.subclasses.length} subclasses and compare their unique abilities.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="mx-auto max-w-7xl">
          <ClassDetailClient classData={classData} />
        </div>
      </div>
    </div>
  );
}

// Generate static params for all classes (optional optimization)
export async function generateStaticParams() {
  const classes = await loadAllClasses();

  return classes.map(classData => ({
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
