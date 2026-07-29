'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings, Globe, MapPin, AlertTriangle, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { getOrgMe, updateOrgConfig } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

const LABEL_STYLE = {
  fontFamily: MONO,
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-3)',
};

const SECTION_HEADER_STYLE = {
  padding: '12px 20px',
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--bg-surface-2)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const SECTION_TITLE_STYLE = {
  fontFamily: MONO,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--fg-2)',
};

const CARD_STYLE = {
  background: 'var(--bg-surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const INPUT_BASE_STYLE = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: '2px',
  fontFamily: SANS,
  fontSize: '13px',
  color: 'var(--fg-1)',
  transition: 'border-color 120ms',
};

const ZONE_TYPES = ['gate', 'building', 'zone', 'perimeter'];

function emptyZone() {
  return { name: '', type: 'gate', lat: '', lng: '' };
}

function zonesFromGeometry(siteGeometry) {
  const locs = siteGeometry?.locations;
  if (!Array.isArray(locs) || locs.length === 0) return [emptyZone()];
  return locs.map((loc) => {
    const c = loc.coordinates;
    const lat = Array.isArray(c) ? c[0] : c?.lat;
    const lng = Array.isArray(c) ? c[1] : c?.lng;
    return {
      name: loc.name || '',
      type: loc.type || 'zone',
      lat: lat ?? '',
      lng: lng ?? '',
    };
  });
}

function buildSiteGeometry(zones) {
  const locations = zones
    .filter((z) => z.name.trim() && z.lat !== '' && z.lng !== '')
    .map((z, i) => ({
      id: `zone-${i + 1}`,
      name: z.name.trim(),
      type: z.type || 'zone',
      coordinates: { lat: Number(z.lat), lng: Number(z.lng) },
      zone: z.type === 'gate' || z.type === 'perimeter' ? 'perimeter' : 'interior',
    }));
  return locations.length ? { locations } : null;
}

export default function GeneralSettingsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const canEdit = role === 'org_admin' || role === 'super_admin';

  const { data: site, isLoading, isError } = useQuery({
    queryKey: ['org-me'],
    queryFn: getOrgMe,
  });

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [locationLabel, setLocationLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [zones, setZones] = useState([emptyZone()]);
  const [webhookError, setWebhookError] = useState('');

  useEffect(() => {
    if (!site) return;
    setName(site.name ?? '');
    setTimezone(site.timezone ?? 'UTC');
    setLocationLabel(site.locationLabel ?? '');
    setLat(site.coordinates?.lat ?? '');
    setLng(site.coordinates?.lng ?? '');
    setWebhookUrl(site.webhookUrl ?? '');
    setZones(zonesFromGeometry(site.siteGeometry));
  }, [site]);

  function validateWebhook(val) {
    if (val && !/^https?:\/\//i.test(val)) {
      return 'Webhook URL must start with http:// or https://';
    }
    return '';
  }

  const saveMutation = useMutation({
    mutationFn: (payload) => updateOrgConfig(payload),
    onSuccess: () => {
      toast.success('Site settings saved');
      queryClient.invalidateQueries({ queryKey: ['org-me'] });
      queryClient.invalidateQueries({ queryKey: ['siteMap'] });
      queryClient.invalidateQueries({ queryKey: ['eventPins'] });
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Failed to save settings');
    },
  });

  function handleSave(e) {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Only admins can change site configuration');
      return;
    }

    const vErr = validateWebhook(webhookUrl);
    if (vErr) {
      setWebhookError(vErr);
      return;
    }
    setWebhookError('');

    if (lat === '' || lng === '') {
      toast.error('Map center latitude and longitude are required');
      return;
    }

    const payload = {
      name: name.trim() || 'Site',
      timezone: timezone.trim() || 'UTC',
      locationLabel: locationLabel.trim() || null,
      coordinates: { lat: Number(lat), lng: Number(lng) },
      siteGeometry: buildSiteGeometry(zones),
      webhookUrl: webhookUrl.trim() || null,
    };

    saveMutation.mutate(payload);
  }

  function updateZone(index, field, value) {
    setZones((prev) => prev.map((z, i) => (i === index ? { ...z, [field]: value } : z)));
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '96px 0', color: 'var(--fg-3)', fontFamily: SANS, fontSize: '13px',
      }}>
        <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
        Loading site settings…
      </div>
    );
  }

  if (isError || !site) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        border: '1px solid var(--border-default)',
        borderLeft: '2px solid var(--sev-serious)',
        background: 'var(--bg-surface-1)', borderRadius: '2px',
        padding: '12px 16px', color: 'var(--sev-serious)',
        fontFamily: SANS, fontSize: '13px',
      }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        Failed to load site settings. Please refresh the page.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: SANS }}>
      <div>
        <h1 style={{
          fontFamily: SANS, fontSize: '20px', fontWeight: 600,
          letterSpacing: '-0.01em', color: 'var(--fg-1)',
          display: 'flex', alignItems: 'center', gap: '10px', margin: 0,
        }}>
          <Settings size={16} style={{ color: 'var(--accent)' }} />
          Site configuration
        </h1>
        <p style={{
          fontFamily: SANS, fontSize: '12px', color: 'var(--fg-3)',
          margin: '6px 0 0 0',
        }}>
          Name, map center, zones, and outbound webhook for this Sentinel site.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <section style={CARD_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <Globe size={13} style={{ color: 'var(--fg-3)' }} />
            <h2 style={SECTION_TITLE_STYLE}>Site</h2>
          </div>
          <div style={{ padding: '20px', display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="siteName" style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}>Name</label>
              <input id="siteName" style={INPUT_BASE_STYLE} value={name} disabled={!canEdit}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="timezone" style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}>Timezone</label>
              <input id="timezone" style={INPUT_BASE_STYLE} value={timezone} disabled={!canEdit}
                placeholder="UTC" onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="locationLabel" style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}>Location label</label>
              <input id="locationLabel" style={INPUT_BASE_STYLE} value={locationLabel} disabled={!canEdit}
                placeholder="North Gate Plant" onChange={(e) => setLocationLabel(e.target.value)} />
            </div>
          </div>
        </section>

        <section style={CARD_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <MapPin size={13} style={{ color: 'var(--fg-3)' }} />
            <h2 style={SECTION_TITLE_STYLE}>Map center</h2>
          </div>
          <div style={{ padding: '20px', display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label htmlFor="lat" style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}>Latitude</label>
              <input id="lat" type="number" step="any" style={INPUT_BASE_STYLE} value={lat} disabled={!canEdit}
                placeholder="51.5074" onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <label htmlFor="lng" style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}>Longitude</label>
              <input id="lng" type="number" step="any" style={INPUT_BASE_STYLE} value={lng} disabled={!canEdit}
                placeholder="-0.1278" onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
        </section>

        <section style={CARD_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <MapPin size={13} style={{ color: 'var(--fg-3)' }} />
            <h2 style={SECTION_TITLE_STYLE}>Zones</h2>
            {canEdit && (
              <button type="button" onClick={() => setZones((z) => [...z, emptyZone()])}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'transparent', border: '1px solid var(--border-default)',
                  color: 'var(--fg-2)', fontFamily: MONO, fontSize: '10px',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '4px 8px', cursor: 'pointer',
                }}>
                <Plus size={12} /> Add zone
              </button>
            )}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--fg-3)' }}>
              Add named locations (gates, buildings). These become map zones for Argus and the incidents map.
            </p>
            {zones.map((zone, index) => (
              <div key={index} style={{
                display: 'grid', gap: '8px',
                gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.8fr auto',
                alignItems: 'end',
              }}>
                <div>
                  <label style={{ ...LABEL_STYLE, display: 'block', marginBottom: '4px' }}>Name</label>
                  <input style={INPUT_BASE_STYLE} value={zone.name} disabled={!canEdit}
                    placeholder="North Gate" onChange={(e) => updateZone(index, 'name', e.target.value)} />
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE, display: 'block', marginBottom: '4px' }}>Type</label>
                  <select style={INPUT_BASE_STYLE} value={zone.type} disabled={!canEdit}
                    onChange={(e) => updateZone(index, 'type', e.target.value)}>
                    {ZONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE, display: 'block', marginBottom: '4px' }}>Lat</label>
                  <input type="number" step="any" style={INPUT_BASE_STYLE} value={zone.lat} disabled={!canEdit}
                    onChange={(e) => updateZone(index, 'lat', e.target.value)} />
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE, display: 'block', marginBottom: '4px' }}>Lng</label>
                  <input type="number" step="any" style={INPUT_BASE_STYLE} value={zone.lng} disabled={!canEdit}
                    onChange={(e) => updateZone(index, 'lng', e.target.value)} />
                </div>
                {canEdit && (
                  <button type="button" aria-label="Remove zone"
                    disabled={zones.length <= 1}
                    onClick={() => setZones((z) => z.filter((_, i) => i !== index))}
                    style={{
                      background: 'transparent', border: '1px solid var(--border-default)',
                      color: 'var(--fg-3)', padding: '8px', cursor: zones.length <= 1 ? 'not-allowed' : 'pointer',
                    }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={CARD_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <Globe size={13} style={{ color: 'var(--fg-3)' }} />
            <h2 style={SECTION_TITLE_STYLE}>Webhook</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <label htmlFor="webhookUrl" style={{ ...LABEL_STYLE, display: 'block', marginBottom: '6px' }}>
              Webhook URL
            </label>
            <input
              id="webhookUrl"
              type="text"
              autoComplete="off"
              placeholder="https://your-server.com/webhooks/sentinel"
              value={webhookUrl}
              disabled={!canEdit}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setWebhookError(validateWebhook(e.target.value));
              }}
              style={{
                ...INPUT_BASE_STYLE,
                borderColor: webhookError ? 'var(--sev-serious)' : 'var(--border-default)',
              }}
            />
            {webhookError && (
              <p style={{
                margin: '6px 0 0 0', fontFamily: SANS, fontSize: '11px',
                color: 'var(--sev-serious)', display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <AlertTriangle size={11} />
                {webhookError}
              </p>
            )}
          </div>
        </section>

        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'var(--accent)', color: 'var(--bg-base)',
                border: 'none', borderRadius: '2px',
                padding: '10px 16px', fontFamily: MONO, fontSize: '11px',
                fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: saveMutation.isPending ? 'wait' : 'pointer',
              }}
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save site
            </button>
          </div>
        )}

        {!canEdit && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--fg-3)' }}>
            You can view site settings. An admin is required to change them.
          </p>
        )}
      </form>
    </div>
  );
}
