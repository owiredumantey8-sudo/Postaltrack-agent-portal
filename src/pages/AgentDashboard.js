import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://postaltrack-backend-production.up.railway.app/api';

const STATUS_META = {
  booked: { color: '#f59e0b', bg: '#fffbeb', label: 'Booked', tip: '⚠️ Needs pickup' },
  picked_up: { color: '#3b82f6', bg: '#eff6ff', label: 'Picked Up', tip: '' },
  in_transit: { color: '#8b5cf6', bg: '#f5f3ff', label: 'In Transit', tip: '' },
  dispatched: { color: '#0ea5e9', bg: '#ecfeff', label: 'Dispatched', tip: '🚚 On the way' },
  out_for_delivery: { color: '#f97316', bg: '#fff7ed', label: 'Out for Delivery', tip: '🔥 Deliver today' },
  delivered: { color: '#10b981', bg: '#ecfdf5', label: 'Delivered', tip: '' },
  failed_delivery: { color: '#ef4444', bg: '#fef2f2', label: 'Failed Delivery', tip: '❗ Needs attention' },
};

const sm = (s) => STATUS_META[s] || { color: '#6b7280', bg: '#f9fafb', label: s, tip: '' };

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const ok = msg.startsWith('✅');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        padding: '13px 20px',
        borderRadius: 12,
        background: ok ? '#ecfdf5' : '#fef2f2',
        border: `1.5px solid ${ok ? '#10b981' : '#ef4444'}`,
        color: ok ? '#065f46' : '#991b1b',
        fontWeight: 700,
        fontSize: 14,
        boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
        animation: 'slideUp .25s ease',
      }}
    >
      {msg}
    </div>
  );
}

function Badge({ status }) {
  const { color, bg, label } = sm(status);
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color,
        fontWeight: 700,
        fontSize: 11,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
    </span>
  );
}

function Overlay({ onClose, children, wide }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 18,
          width: '100%',
          maxWidth: wide ? 760 : 520,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, sub, onClose }) {
  return (
    <div
      style={{
        padding: '1.2rem 1.5rem',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{title}</div>
        {sub && (
          <div
            style={{
              fontSize: 11,
              color: '#9ca3af',
              marginTop: 2,
              fontFamily: 'monospace',
              letterSpacing: 1,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          background: '#f3f4f6',
          border: 'none',
          borderRadius: '50%',
          width: 32,
          height: 32,
          cursor: 'pointer',
          fontSize: 14,
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function ParcelInfoStrip({ parcel }) {
  const rows = [
    { label: 'Recipient', value: parcel.recipient_name },
    {
      label: 'Phone',
      value: (
        <a
          href={`tel:${parcel.recipient_phone}`}
          style={{ color: '#059669', fontWeight: 700, textDecoration: 'none' }}
        >
          📞 {parcel.recipient_phone}
        </a>
      ),
    },
    { label: 'Address', value: parcel.recipient_address },
    { label: 'Weight', value: parcel.weight_kg ? `${parcel.weight_kg} kg` : null },
    { label: 'Booked', value: formatDate(parcel.created_at || parcel.booked_at) },
  ].filter((r) => r.value);

  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 14px', fontSize: 13 }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            padding: '7px 0',
            borderBottom: i < rows.length - 1 ? '1px solid #eef2f7' : 'none',
          }}
        >
          <span style={{ color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
          <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right', fontSize: 12 }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MapModal({ parcel, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [geoStatus, setGeoStatus] = useState('loading');
  const [coords, setCoords] = useState(null);
  const [geoLabel, setGeoLabel] = useState('');

  useEffect(() => {
    const loadLeaflet = () =>
      new Promise((resolve, reject) => {
        if (window.L) {
          resolve();
          return;
        }

        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        const existing = document.getElementById('leaflet-js');
        if (existing) {
          if (window.L) {
            resolve();
            return;
          }
          existing.addEventListener('load', resolve);
          existing.addEventListener('error', reject);
          return;
        }

        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

    const run = async () => {
      try {
        await loadLeaflet();

        const nominatim = async (q) => {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              q
            )}&format=json&limit=1&accept-language=en`
          );
          const d = await r.json();
          return d.length ? d[0] : null;
        };

        const ghanaGpsRegex = /[A-Z]{2}-\d{3}-\d{4}/gi;

        let hit = await nominatim(`${parcel.recipient_address}, Ghana`);

        if (!hit) {
          const stripped = parcel.recipient_address
            .replace(ghanaGpsRegex, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          if (stripped) hit = await nominatim(`${stripped}, Ghana`);
        }

        if (!hit) {
          const firstWord = parcel.recipient_address.split(/\s+/)[0];
          if (firstWord) hit = await nominatim(`${firstWord}, Accra, Ghana`);
        }

        if (!hit) {
          setGeoStatus('error');
          return;
        }

        setCoords({
          lat: parseFloat(hit.lat),
          lon: parseFloat(hit.lon),
        });
        setGeoLabel(hit.display_name);
        setGeoStatus('found');
      } catch {
        setGeoStatus('error');
      }
    };

    run();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [parcel.recipient_address]);

  useEffect(() => {
    if (geoStatus !== 'found' || !coords || !mapRef.current || mapInstance.current) return;

    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([coords.lat, coords.lon], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:32px;height:42px">
          <div style="
            width:32px;height:32px;border-radius:50% 50% 50% 0;
            background:#065f46;border:3px solid white;
            transform:rotate(-45deg);
            box-shadow:0 3px 10px rgba(0,0,0,0.35);">
          </div>
          <div style="
            position:absolute;top:8px;left:8px;
            width:12px;height:12px;border-radius:50%;
            background:white;">
          </div>
        </div>`,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -44],
    });

    L.marker([coords.lat, coords.lon], { icon: pinIcon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:sans-serif;min-width:180px">
          <div style="font-weight:800;font-size:13px;color:#111827;margin-bottom:4px">
            📦 ${parcel.recipient_name}
          </div>
          <div style="font-size:12px;color:#6b7280;line-height:1.4">
            ${parcel.recipient_address}
          </div>
          <div style="margin-top:6px">
            <span style="
              background:#ecfdf5;color:#065f46;
              padding:2px 8px;border-radius:10px;
              font-size:11px;font-weight:700;">
              Destination
            </span>
          </div>
        </div>`)
      .openPopup();

    L.circle([coords.lat, coords.lon], {
      radius: 80,
      color: '#065f46',
      fillColor: '#065f46',
      fillOpacity: 0.08,
      weight: 1.5,
    }).addTo(map);

    mapInstance.current = map;
  }, [geoStatus, coords, parcel.recipient_name, parcel.recipient_address]);

  return (
    <Overlay onClose={onClose} wide>
      <ModalHeader title="📍 Delivery Destination" sub={parcel.tracking_number} onClose={onClose} />
      <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
        <ParcelInfoStrip parcel={parcel} />

        <div
          style={{
            marginTop: 16,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1.5px solid #e5e7eb',
            background: '#f8fafc',
            minHeight: 340,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {geoStatus === 'loading' && (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>
              <div style={{ fontSize: 36, marginBottom: 10, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>
                🗺️
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Locating destination…</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Geocoding address with OpenStreetMap
              </div>
            </div>
          )}

          {geoStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#ef4444' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>❌</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Address not found on map</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Try searching manually: <b>{parcel.recipient_address}</b>
              </div>
            </div>
          )}

          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: 340,
              display: geoStatus === 'found' ? 'block' : 'none',
            }}
          />
        </div>

        {geoStatus === 'found' && geoLabel && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 4,
            }}
          >
            <span>📌</span>
            <span style={{ lineHeight: 1.4 }}>{geoLabel}</span>
          </div>
        )}

        {geoStatus === 'found' && coords && (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                minWidth: 180,
                padding: '11px 0',
                borderRadius: 9,
                textAlign: 'center',
                background: '#065f46',
                color: 'white',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
                display: 'block',
              }}
            >
              🧭 Open in Google Maps
            </a>
            <a
              href={`https://waze.com/ul?ll=${coords.lat},${coords.lon}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                minWidth: 180,
                padding: '11px 0',
                borderRadius: 9,
                textAlign: 'center',
                background: '#00aff5',
                color: 'white',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
                display: 'block',
              }}
            >
              🚗 Open in Waze
            </a>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function HistoryModal({ parcel, token, onClose }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/parcels/events/${parcel.parcel_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setEvents(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [parcel.parcel_id, token]);

  return (
    <Overlay onClose={onClose}>
      <ModalHeader title="📋 Parcel History" sub={parcel.tracking_number} onClose={onClose} />
      <div style={{ padding: '1.25rem 1.5rem' }}>
        <ParcelInfoStrip parcel={parcel} />
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 14 }}>
            Status Timeline
          </div>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 0' }}>Loading…</p>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No status updates logged yet</div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 10,
                  bottom: 10,
                  width: 2,
                  background: '#e5e7eb',
                }}
              />
              {events.map((ev, i) => {
                const meta = sm(ev.status_code);
                return (
                  <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        flexShrink: 0,
                        zIndex: 1,
                        background: meta.bg,
                        border: `2px solid ${meta.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                      }}
                    >
                      ●
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: meta.bg,
                        border: `1px solid ${meta.color}33`,
                        borderRadius: 10,
                        padding: '9px 13px',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: meta.color, fontSize: 12 }}>{meta.label}</div>
                      {ev.location && (
                        <div style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>
                          📍 {ev.location}
                        </div>
                      )}
                      {ev.event_description && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          💬 {ev.event_description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {new Date(ev.event_timestamp).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// --- CORRECTED UPDATE MODAL (STRICT STATUS HANDOVER) ---
function UpdateModal({ parcel, token, onClose, onSuccess }) {
  // Strict Chain of Custody: Agents ONLY get these 3 options
    const agentStatuses = [
    { value: 'in_transit', label: '🚚 In Transit' },
    { value: 'out_for_delivery', label: '📍 Out for Delivery' },
    { value: 'delivered', label: '✅ Delivered' },
    { value: 'failed_delivery', label: '❌ Failed Delivery' },
  ];

  // Safety fallback: If admin assigns it as 'dispatched', default the agent modal to 'out_for_delivery'
  const allowedStatuses = agentStatuses.map(s => s.value);
  const safeDefaultStatus = allowedStatuses.includes(parcel.current_status) 
    ? parcel.current_status 
    : 'out_for_delivery';

  const [status, setStatus] = useState(safeDefaultStatus);
  const [location, setLocation] = useState(parcel.current_location || '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!location.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/parcels/update/${parcel.parcel_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_status: status,
          current_location: location,
          description: note,
        }),
      });

      if (res.ok) {
        onSuccess('✅ Parcel updated');
        onClose();
      } else {
        onSuccess('❌ Update failed');
      }
    } catch {
      onSuccess('❌ Server error');
    }
    setLoading(false);
  };

  return (
    <Overlay onClose={onClose}>
      <ModalHeader title="✏️ Update Parcel" sub={parcel.tracking_number} onClose={onClose} />
      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ParcelInfoStrip parcel={parcel} />

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>New Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {agentStatuses.map((s) => {
              const meta = sm(s.value);
              const active = status === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 12,
                    border: `2px solid ${active ? meta.color : '#e5e7eb'}`,
                    background: active ? meta.bg : 'white',
                    color: active ? meta.color : '#6b7280',
                    fontWeight: active ? 700 : 500,
                    transition: 'all .15s',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Current Location *
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Accra, Tema, Kumasi…"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid #e5e7eb',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              background: '#fafafa',
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Note (optional)
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Customer not home, left at gate…"
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid #e5e7eb',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
              background: '#fafafa',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSubmit}
            disabled={loading || !location.trim()}
            style={{
              flex: 2,
              padding: '11px 0',
              borderRadius: 9,
              border: 'none',
              background: loading || !location.trim() ? '#a7f3d0' : '#059669',
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading || !location.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Saving…' : '✅ Save Update'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 9,
              border: '1.5px solid #e5e7eb',
              background: 'white',
              color: '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function EmptyState({ title, subtitle, icon }) {
  return (
    <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: '#111827', fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, sub }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 18,
        padding: '1rem 1.15rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        border: `1px solid ${color}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 96,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
      </div>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const [parcels, setParcels] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const agentToken = localStorage.getItem('agentToken');
  const agentName = localStorage.getItem('agentName');
  const agentId = localStorage.getItem('agentId');
  const agentRole = localStorage.getItem('agentRole');

  const fetchParcels = useCallback(async () => {
    try {
      const res = await fetch(`${API}/parcels/agent/${agentId}`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setParcels(data);
    } catch {
      setToast('❌ Failed to load parcels');
    }
  }, [agentId, agentToken]);

  useEffect(() => {
    if (!agentToken || agentRole !== 'courier_agent') {
      navigate('/');
      return;
    }
    fetchParcels();
  }, [agentToken, agentRole, navigate, fetchParcels]);

  const stats = {
    total: parcels.length,
    pending: parcels.filter((p) => p.current_status !== 'delivered' && p.current_status !== 'failed_delivery').length,
    delivered: parcels.filter((p) => p.current_status === 'delivered').length,
    urgent: parcels.filter((p) => p.current_status === 'out_for_delivery').length,
  };

  const displayed = parcels.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search.trim() ||
      p.tracking_number?.toLowerCase().includes(q) ||
      p.recipient_name?.toLowerCase().includes(q) ||
      p.recipient_address?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.current_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = [...displayed].sort((a, b) => {
    const priority = {
      out_for_delivery: 0,
      dispatched: 1,
      booked: 2,
      picked_up: 3,
      in_transit: 4,
      failed_delivery: 5,
      delivered: 6,
    };
    return (priority[a.current_status] ?? 9) - (priority[b.current_status] ?? 9);
  });

  const openModal = (type, parcel) => {
    setSelectedParcel(parcel);
    setModal(type);
  };

  const closeModal = () => {
    setModal(null);
    setSelectedParcel(null);
  };

  const deliveredOnly = parcels.length > 0 && parcels.every((p) => p.current_status === 'delivered');

  return (
    <div style={{ minHeight: '100vh', background: '#f3f7f5', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes slideUp { from { transform: translateY(16px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        tbody tr:hover td { background: #f8fdfb !important; transition: background .15s; }
        .act-btn:hover { filter: brightness(.94); }
        @media (max-width: 860px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .table-shell { overflow-x: auto; }
        }
        @media (max-width: 640px) {
          .container-pad { padding: 1rem !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
          .topbar { padding: 0 1rem !important; }
          .topbar-right { gap: 8px !important; }
          .search-grid { grid-template-columns: 1fr !important; }
          .search-wrap { padding: 1rem !important; }
          .actions-row { flex-direction: column !important; align-items: stretch !important; }
          .actions-row button, .actions-row a { width: 100% !important; }
        }
      `}</style>

      <nav
        className="topbar"
        style={{
          background: '#065f46',
          padding: '0 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 64,
          boxShadow: '0 2px 12px rgba(6,95,70,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚚</span>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 17 }}>PostalTrack</span>
          <span
            style={{
              marginLeft: 8,
              background: '#10b981',
              color: 'white',
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 999,
            }}
          >
            {stats.pending} active
          </span>
        </div>

        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
            title="Notifications"
          >
            🔔
          </button>
          <span style={{ color: '#a7f3d0', fontSize: 14, fontWeight: 600 }}>{agentName}</span>
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
            style={{
              padding: '7px 16px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="container-pad" style={{ padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div
          className="stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <StatCard
            label="Total Assigned"
            value={stats.total}
            icon="📦"
            color="#0f766e"
            bg="#ccfbf1"
            sub="All parcels currently assigned"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon="⏳"
            color="#d97706"
            bg="#ffedd5"
            sub="Not yet delivered or failed"
          />
          <StatCard
            label="Urgent"
            value={stats.urgent}
            icon="🔥"
            color="#ea580c"
            bg="#ffedd5"
            sub="Out for delivery today"
          />
          <StatCard
            label="Delivered"
            value={stats.delivered}
            icon="✅"
            color="#059669"
            bg="#dcfce7"
            sub="Completed successfully"
          />
        </div>

        <div
          className="search-wrap"
          style={{
            background: 'white',
            borderRadius: 16,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr auto',
            gap: '0.85rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            alignItems: 'end',
          }}
        >
          <div className="search-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5 }}>Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tracking #, recipient, or address…"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5 }}>Status</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                  background: '#fafafa',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="booked">Booked</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="dispatched">Dispatched</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="failed_delivery">Failed Delivery</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchParcels}
            style={{
              padding: '10px 18px',
              background: '#065f46',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
              height: 42,
            }}
          >
            🔄 Refresh
          </button>
        </div>

        <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.4rem',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 800, color: '#111827', fontSize: 15 }}>
              📦 My Assigned Parcels — {sorted.length}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Sorted by priority</span>
          </div>

          {deliveredOnly ? (
            <EmptyState
              icon="🎉"
              title="All parcels delivered"
              subtitle="Great work. There are no active parcels left in your queue right now."
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No parcels found"
              subtitle={parcels.length === 0 ? 'No parcels assigned to you yet.' : 'Try adjusting your search or filter.'}
            />
          ) : (
            <div className="table-shell">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tracking #', 'Recipient', 'Phone', 'Address', 'Status', 'Date Booked', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '11px 14px',
                          textAlign: 'left',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#9ca3af',
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #f3f4f6',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((parcel, i) => {
                    const meta = sm(parcel.current_status);
                    const isUrgent = parcel.current_status === 'out_for_delivery';
                    const needsPickup = parcel.current_status === 'booked';

                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid #f9fafb',
                          background: isUrgent ? '#fff7ed' : needsPickup ? '#fffbeb' : 'white',
                        }}
                      >
                        <td
                          style={{
                            padding: '12px 14px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#059669',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {parcel.tracking_number}
                        </td>

                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#111827', fontSize: 13 }}>
                          {parcel.recipient_name}
                        </td>

                        <td style={{ padding: '12px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                          <a href={`tel:${parcel.recipient_phone}`} style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>
                            📞 {parcel.recipient_phone}
                          </a>
                        </td>

                        <td
                          style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12, maxWidth: 170 }}
                          title={parcel.recipient_address}
                        >
                          {parcel.recipient_address?.substring(0, 26)}
                          {parcel.recipient_address?.length > 26 ? '…' : ''}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Badge status={parcel.current_status} />
                            {meta.tip && (
                              <span style={{ fontSize: 10, color: meta.color, fontWeight: 700 }}>{meta.tip}</span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {formatDate(parcel.created_at || parcel.booked_at)}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div className="actions-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="act-btn"
                              onClick={() => openModal('map', parcel)}
                              style={{
                                padding: '6px 11px',
                                borderRadius: 7,
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#065f46',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              📍 Map
                            </button>

                            <button
                              className="act-btn"
                              onClick={() => openModal('history', parcel)}
                              style={{
                                padding: '6px 11px',
                                borderRadius: 7,
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              📋 History
                            </button>

                            {parcel.current_status !== 'delivered' && (
                              <button
                                className="act-btn"
                                onClick={() => openModal('update', parcel)}
                                style={{
                                  padding: '6px 11px',
                                  borderRadius: 7,
                                  border: '1px solid #a7f3d0',
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                ✏️ Update
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal === 'map' && selectedParcel && <MapModal parcel={selectedParcel} onClose={closeModal} />}
      {modal === 'update' && selectedParcel && (
        <UpdateModal
          parcel={selectedParcel}
          token={agentToken}
          onClose={closeModal}
          onSuccess={(msg) => {
            setToast(msg);
            fetchParcels();
          }}
        />
      )}
      {modal === 'history' && selectedParcel && (
        <HistoryModal parcel={selectedParcel} token={agentToken} onClose={closeModal} />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  );
}