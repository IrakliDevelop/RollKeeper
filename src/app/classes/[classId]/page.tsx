import { notFound } from 'next/navigation';
import { loadAllClasses } from '@/utils/classDataLoader';
import { getClassById } from '@/utils/classFilters';
import ClassDetailClient from '@/components/classes/ClassDetailClient';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/layout/badge';

interface ClassDetailPageProps {
  params: Promise<{
    classId: string;
  }>;
}

export default async function ClassDetailPage({
  params,
}: ClassDetailPageProps) {
  const { classId } = await params;
  const classes = await loadAllClasses();
  const classData = getClassById(classes, classId);

  if (!classData) notFound();

  return (
    <div className="bg-surface min-h-screen">
      <div className="bg-surface-raised border-divider border-b">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-4">
            <Link
              href="/classes"
              className="text-muted hover:text-heading inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Classes</span>
            </Link>
          </div>
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center gap-4">
              <div className="bg-accent-emerald-bg flex h-14 w-14 items-center justify-center rounded-xl sm:h-16 sm:w-16">
                <Shield className="text-accent-emerald-text h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h1 className="text-heading text-3xl font-bold sm:text-4xl md:text-5xl">
                  {classData.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <span className="text-accent-emerald-text font-medium">
                    {classData.source}
                  </span>
                  {classData.page && (
                    <span className="text-muted">Page {classData.page}</span>
                  )}
                  {classData.isSrd && (
                    <Badge variant="success" size="sm">
                      SRD
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <p className="text-body mx-auto max-w-3xl text-base sm:text-lg">
              Explore the complete {classData.name} class with all features,
              subclasses, and progression details.
              {classData.subclasses.length > 0 &&
                ` Choose from ${classData.subclasses.length} subclasses.`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ClassDetailClient classData={classData} />
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  const classes = await loadAllClasses();
  return classes.map(classData => ({ classId: classData.id }));
}

export async function generateMetadata({ params }: ClassDetailPageProps) {
  const { classId } = await params;
  const classes = await loadAllClasses();
  const classData = getClassById(classes, classId);

  if (!classData) return { title: 'Class Not Found' };

  return {
    title: `${classData.name} - D&D Class Details | RollKeeper`,
    description: `Complete ${classData.name} class guide with features, subclasses, and progression.`,
  };
}
