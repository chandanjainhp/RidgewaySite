'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { ShieldCheck, Filter, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    action: '',
    orgId: '',
    actor: ''
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-audit', filters],
    queryFn: async () => {
      const res = await api.get('/admin/audit', {
        params: { ...filters, limit: 100 }
      });
      return res.data;
    }
  });

  const logs = response?.data?.data || [];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getActionBadge = (action) => {
    let colors = 'bg-gray-100 text-gray-800';
    if (action.includes('created') || action.includes('activated') || action.includes('started')) {
      colors = 'bg-blue-100 text-blue-800';
    } else if (action.includes('updated') || action.includes('changed') || action.includes('applied')) {
      colors = 'bg-amber-100 text-amber-800';
    } else if (action.includes('revoked') || action.includes('suspended') || action.includes('deactivated') || action.includes('deleted') || action.includes('logged_out')) {
      colors = 'bg-red-100 text-red-800';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center">
          <ShieldCheck className="w-6 h-6 mr-2 text-indigo-500" />
          Audit Log
        </h1>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center text-sm text-gray-500 mb-3 font-medium">
          <Filter className="w-4 h-4 mr-1.5" /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Action Type</label>
            <select
              name="action"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              value={filters.action}
              onChange={handleFilterChange}
            >
              <option value="">All Actions</option>
              <option value="org.created">org.created</option>
              <option value="org.suspended">org.suspended</option>
              <option value="org.activated">org.activated</option>
              <option value="org.config_updated">org.config_updated</option>
              <option value="user.role_changed">user.role_changed</option>
              <option value="user.force_logged_out">user.force_logged_out</option>
              <option value="user.deactivated">user.deactivated</option>
              <option value="apiKey.revoked">apiKey.revoked</option>
              <option value="investigation.started">investigation.started</option>
              <option value="briefing.approved">briefing.approved</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Organisation ID</label>
            <input
              type="text"
              name="orgId"
              placeholder="Filter by Org ID..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              value={filters.orgId}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Actor ID</label>
            <input
              type="text"
              name="actor"
              placeholder="Filter by User ID..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              value={filters.actor}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">Timestamp</th>
                <th scope="col" className="px-6 py-3 font-semibold">Actor</th>
                <th scope="col" className="px-6 py-3 font-semibold">Action</th>
                <th scope="col" className="px-6 py-3 font-semibold">Target</th>
                <th scope="col" className="px-6 py-3 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-400 font-sans text-sm">Loading audit logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-400 font-sans text-sm">No audit logs match your filters.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="border-b bg-white hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4">
                      {log.actor ? (
                        <div>
                          <div className="font-medium text-gray-900">{log.actor.email || log.actor.username}</div>
                          <div className="text-gray-400 mt-0.5">{log.actorRole}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">System / Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getActionBadge(log.action)}
                      {log.orgId && (
                        <div className="mt-1.5 text-gray-400 truncate max-w-[150px]" title={`Org: ${log.orgId.name}`}>
                          {log.orgId.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{log.target.type}</div>
                      <div className="text-gray-400 mt-0.5 truncate max-w-[150px]" title={log.target.id}>{log.target.id}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {Object.keys(log.metadata || {}).length > 0 ? (
                        <div className="inline-block text-left relative group">
                          <button className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">
                            View Data
                          </button>
                          <div className="hidden group-hover:block absolute right-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-gray-100 rounded-lg shadow-xl z-10 break-words">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                            {log.ip && <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">IP: {log.ip}</div>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
