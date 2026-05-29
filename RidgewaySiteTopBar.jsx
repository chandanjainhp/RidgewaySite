              fontSize: 11,
              letterSpacing: '0.08em',
              color: pathname === '/briefing' ? '#e2e8f0' : '#4a5568',
              fontFamily: 'monospace',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
          >
            BRIEFING
          </Link>
        </nav>
      </div>

      {/* CENTER SECTION */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <span
          style={{
            fontSize: 13,
            color: '#8892a4',
            fontFamily: 'monospace',
            fontWeight: 500,
          }}
        >
          {formatNightLabel(new Date())}
        </span>
      </div>

      {/* RIGHT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 'none' }}>
        {/* Running incidents count */}
        {jobStatus === 'running' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="dot-pulse"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'inline-block',
                marginRight: 4,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: '#3b82f6',
                fontFamily: 'monospace',
                fontWeight: 500,
              }}
            >
              {resolvedIncidents} / {totalIncidents} incidents
            </span>
          </span>
        )}
        {/* Escalation badge */}
        {escalationCount > 0 && (
          <span
            style={{
              backgroundColor: '#7f1d1d',
              color: '#fca5a5',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            {escalationCount} ESCALATIONS
          </span>
        )}
        {/* Clock */}
        <span
          style={{
            fontSize: 13,
            fontFamily: 'monospace',
            color: '#e2e8f0',
            fontWeight: 500,
            minWidth: 70,
            textAlign: 'right',
            display: 'inline-block',
          }}
        >
          {time}
        </span>
      </div>
    </header>
  );
}
