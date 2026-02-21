import React from 'react';
import Markdown from 'react-markdown';
import { ARTIST_AGREEMENT } from '../constants';
import { FileText } from 'lucide-react';

export default function Agreement() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-100 rounded-2xl">
          <FileText className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Artist Agreement</h1>
          <p className="text-gray-500 font-medium">Standard terms and conditions for En410 Artists.</p>
        </div>
      </div>

      <div className="bg-white border rounded-[2.5rem] p-10 shadow-sm">
        <div className="prose prose-slate max-w-none markdown-body">
          <Markdown>{ARTIST_AGREEMENT}</Markdown>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center">
        <p className="text-emerald-800 font-medium">
          This agreement is binding for all active Artists on the En410 platform. 
          Changes to these terms will be communicated via email and the En410 App.
        </p>
      </div>
    </div>
  );
}
