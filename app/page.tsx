"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Cpu,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Sun,
  Layers,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Info,
  Sliders,
  Terminal,
  Power
} from 'lucide-react';

interface BmsTelemetry {
  total_voltage: number;
  current_amps: number;
  power_watts: number;
  state_of_charge: number;
  remaining_capacity: number;
  cell_1_voltage: number;
  cell_2_voltage: number;
  cell_3_voltage: number;
  cell_4_voltage: number;
  cell_max: number;
  cell_min: number;
  cell_delta: number;
  cell_avg: number;
  bal_status: 'ACTIVE' | 'IDLE' | string;
  bal_current: number;
  chg_mos: 'ON' | 'OFF' | string;
  dsg_mos: 'ON' | 'OFF' | string;
  alarms: string;
  uptime: number;
  mos_temperature: number;
  battery_temperature_1: number;
  battery_temperature_2: number;
  charge_mode: 'DAY' | 'NIGHT' | string;
  relay_status: 'ON' | 'OFF' | string;
  cycle_count: number;
}

export default function BmsDashboard() {
  const [telemetry, setTelemetry] = useState<BmsTelemetry | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'standby' | 'disconnected' | 'connecting' | 'connected' | 'error'>('standby');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isEngineStarted, setIsEngineStarted] = useState<boolean>(false);
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [mqttLogs, setMqttLogs] = useState<string[]>([]);

  const mqttClientRef = useRef<any>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setMqttLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    if (!isEngineStarted) return;

    addLog("Initializing WebSockets MQTT gateway connection...");
    setConnectionStatus('connecting');

    let client: any;

    const connectMqtt = async () => {
      try {
        const mqtt = await import('mqtt');

        const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
        const topic = 'taras_bachelor_bms/status';

        addLog(`Connecting to External Broker: ${brokerUrl}`);

        client = (mqtt.default || mqtt).connect(brokerUrl, {
          clientId: `bms_scada_${Math.random().toString(16).substring(2, 10)}`,
          clean: true,
          connectTimeout: 5000,
          reconnectPeriod: 2000,
        });

        mqttClientRef.current = client;

        client.on('connect', () => {
          setConnectionStatus('connected');
          addLog(`Successfully ESTABLISHED LINK to Broker!`);
          addLog(`Subscribing to telemetry stream: "${topic}"...`);

          client.subscribe(topic, (err: any) => {
            if (err) {
              addLog(`Stream subscription error: ${err.message}`);
              setConnectionStatus('error');
            } else {
              addLog(`Stream synchronized successfully. Awaiting hardware data packets...`);
            }
          });
        });

        client.on('message', (receivedTopic: string, message: Buffer) => {
          if (receivedTopic === topic) {
            try {
              const payloadStr = message.toString();
              const data = JSON.parse(payloadStr) as BmsTelemetry;

              const parsedTelemetry: BmsTelemetry = {
                total_voltage: Number(data.total_voltage) || 0,
                current_amps: Number(data.current_amps) || 0,
                power_watts: Number(data.power_watts) || 0,
                state_of_charge: Math.min(Math.max(Number(data.state_of_charge) || 0, 0), 100),
                remaining_capacity: Number(data.remaining_capacity) || 0,
                cell_1_voltage: Number(data.cell_1_voltage) || 0,
                cell_2_voltage: Number(data.cell_2_voltage) || 0,
                cell_3_voltage: Number(data.cell_3_voltage) || 0,
                cell_4_voltage: Number(data.cell_4_voltage) || 0,
                cell_max: Number(data.cell_max) || 0,
                cell_min: Number(data.cell_min) || 0,
                cell_delta: Number(data.cell_delta) || 0,
                cell_avg: Number(data.cell_avg) || 0,
                bal_status: data.bal_status || 'IDLE',
                bal_current: Number(data.bal_current) || 0,
                chg_mos: data.chg_mos || 'OFF',
                dsg_mos: data.dsg_mos || 'OFF',
                alarms: data.alarms || 'NONE',
                uptime: Number(data.uptime) || 0,
                mos_temperature: Number(data.mos_temperature) || 0,
                battery_temperature_1: Number(data.battery_temperature_1) || 0,
                battery_temperature_2: Number(data.battery_temperature_2) || 0,
                charge_mode: data.charge_mode || 'DAY',
                relay_status: data.relay_status || 'OFF',
                cycle_count: Number(data.cycle_count) || 0,
              };

              setTelemetry(parsedTelemetry);
              setLastUpdated(new Date());
              addLog(`Packet received. Volts: ${parsedTelemetry.total_voltage}V, SOC: ${parsedTelemetry.state_of_charge}%`);
            } catch (jsonErr) {
              addLog(`Data packet checksum failed: ${String(jsonErr)}`);
            }
          }
        });

        client.on('close', () => {
          setConnectionStatus('disconnected');
          addLog("Gateway connection dropped. Attempting reconnect...");
        });

        client.on('error', (err: any) => {
          setConnectionStatus('error');
          addLog(`Network Error: ${err.message}`);
        });

      } catch (err) {
        setConnectionStatus('error');
        addLog(`Protocol initialization failed: ${String(err)}`);
      }
    };

    connectMqtt();

    return () => {
      if (client) {
        addLog("System standby. Closing active connections...");
        client.end();
      }
    };
  }, [isEngineStarted]);

  if (!telemetry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white font-sans p-6 selection:bg-cyan-500/30">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.3)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>

        <div className="relative flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl max-w-md w-full text-center z-10">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-indigo-500 rounded-t-3xl"></div>

          <div className="relative w-20 h-20 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <Power className={`w-10 h-10 ${isEngineStarted ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
          </div>

          <h2 className="text-xl font-bold tracking-wide text-slate-100 mb-2">BMS SCADA Gateway</h2>

          <p className="text-slate-400 text-sm mb-6 h-10">
            {!isEngineStarted
              ? "System is in standby mode. Awaiting manual connection trigger."
              : connectionStatus === 'connected'
              ? "Connection established. Waiting for first telemetry payload from hardware..."
              : "Negotiating protocol with MQTT broker..."}
          </p>

          <div className="flex items-center space-x-2 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800/80 text-xs text-slate-400 mb-8 w-full justify-center">
            <span className={`w-2 h-2 rounded-full ${isEngineStarted ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`}></span>
            <span className="font-mono">wss://broker.hivemq.com:8884</span>
          </div>

          {!isEngineStarted ? (
            <button
              onClick={() => {
                setIsEngineStarted(true);
                setShowConsole(true);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-bold tracking-widest uppercase shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50 transition-all duration-300 hover:-translate-y-0.5"
            >
              Connect to Broker
            </button>
          ) : (
            <div className="w-full space-y-3">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 w-1/3 animate-[pulse_1s_ease-in-out_infinite_alternate]"></div>
              </div>

              {showConsole && (
                <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] text-left text-slate-400 h-32 overflow-y-auto">
                  {mqttLogs.map((log, idx) => (
                    <div key={idx} className={log.includes('error') || log.includes('failed') ? 'text-rose-400' : log.includes('ESTABLISHED') ? 'text-emerald-400' : ''}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const fmtVolt = (v: number) => v.toFixed(3);
  const fmtAmp = (a: number) => (a > 0 ? `+${a.toFixed(2)}` : a.toFixed(2));
  const fmtPower = (p: number) => (p > 0 ? `+${p.toLocaleString()}` : p.toLocaleString());

  const isCharging = telemetry.current_amps > 0.05;
  const isDischarging = telemetry.current_amps < -0.05;

  const currentStatusText = isCharging ? "CHARGING" : isDischarging ? "DISCHARGING" : "IDLE";

  const getSocColorClass = (soc: number) => {
    if (soc >= 50) return {
      border: 'border-emerald-500/40',
      bgGradient: 'from-emerald-600 to-cyan-400',
      glow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]',
      text: 'text-cyan-400',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    };
    if (soc >= 20) return {
      border: 'border-amber-500/40',
      bgGradient: 'from-amber-600 to-yellow-400',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      text: 'text-amber-400',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    };
    return {
      border: 'border-rose-600/40',
      bgGradient: 'from-rose-700 to-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.45)]',
      text: 'text-red-500 animate-pulse',
      badge: 'bg-red-500/15 text-red-400 border-red-500/20 animate-pulse'
    };
  };

  const socTheme = getSocColorClass(telemetry.state_of_charge);

  return (
    <div className="min-h-screen bg-[#070b13] bg-radial-dot-pattern text-slate-100 p-4 md:p-6 lg:p-8 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.3)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">

        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 bg-[#0d1424]/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
              <Activity className="w-6 h-6 animate-pulse" />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping"></div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white">BMS DASHBOARD</h1>
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-cyan-500/80 px-2 py-0.5 rounded font-mono font-semibold">NODE_01</span>
              </div>
              <p className="text-xs text-slate-400 flex items-center mt-0.5">
                <span className="font-mono text-slate-500 mr-2">TOPIC: taras_bachelor_bms/status</span>
                {lastUpdated && (
                  <span className="text-[11px] text-slate-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Last Packet: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center space-x-2.5 px-4 py-2 rounded-xl border font-mono text-xs font-semibold transition-all ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : connectionStatus === 'connecting'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <span className={`w-2 h-2 rounded-full relative flex ${
                connectionStatus === 'connected' ? 'bg-emerald-400' : connectionStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
              }`}>
                {connectionStatus === 'connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
              </span>
              <span>
                {connectionStatus === 'connected'
                  ? 'GATEWAY ONLINE'
                  : connectionStatus === 'connecting'
                  ? 'ESTABLISHING LINK...'
                  : 'GATEWAY OFFLINE'}
              </span>
            </div>

            <button
              onClick={() => setShowConsole(!showConsole)}
              className={`p-2 rounded-xl border transition-all ${
                showConsole
                  ? 'bg-slate-800 border-slate-700 text-cyan-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
              title="Toggle Console Logs"
            >
              <Terminal className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsEngineStarted(false);
                setTelemetry(null);
              }}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Disconnect & Standby"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </header>

        {showConsole && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs text-slate-300 animate-slide-down">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-500">
              <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-cyan-500" /> SYSTEM GATEWAY CONSOLE LOGS</span>
              <button
                onClick={() => setMqttLogs([])}
                className="text-[10px] hover:text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded transition"
              >
                Clear buffer
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {mqttLogs.map((log, idx) => (
                <div key={idx} className={`${
                  log.includes('Successfully') || log.includes('ESTABLISHED') ? 'text-emerald-400' :
                  log.includes('Failed') || log.includes('error') ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="bg-gradient-to-b from-[#0d1424]/90 to-[#0b101c]/90 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none"></div>
          <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row items-center lg:items-stretch gap-8 lg:gap-12">

            <div className="flex flex-col items-center justify-center relative w-full lg:w-1/3 py-4">
              <div className={`relative w-44 h-76 border-4 ${socTheme.border} rounded-[2.5rem] p-2 bg-slate-950/80 ${socTheme.glow} transition-all duration-700 flex flex-col justify-end overflow-hidden`}>
                <div className={`absolute -top-0.5 left-1/2 -translate-x-1/2 w-14 h-4 bg-slate-800 rounded-b-xl border-x-4 border-b-4 ${socTheme.border} z-20`}></div>

                <div
                  className={`w-full bg-gradient-to-t ${socTheme.bgGradient} rounded-[1.8rem] transition-all duration-1000 ease-out relative flex items-center justify-center overflow-hidden`}
                  style={{ height: `${telemetry.state_of_charge}%`, minHeight: '8%' }}
                >
                  {isCharging && (
                    <div className="absolute inset-0 flex flex-col items-center justify-around text-emerald-100/30 font-bold tracking-widest text-2xl select-none pointer-events-none animate-pulse">
                      <TrendingUp className="w-10 h-10 animate-bounce" />
                    </div>
                  )}
                  {isDischarging && (
                    <div className="absolute inset-0 flex flex-col items-center justify-around text-rose-100/25 font-bold tracking-widest text-2xl select-none pointer-events-none animate-pulse">
                      <TrendingDown className="w-10 h-10 animate-bounce" />
                    </div>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-6 top-6 flex flex-col justify-between pointer-events-none px-4 z-10">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-0.5 border-t border-dashed transition-colors duration-500 ${
                        (9 - i) * 10 <= telemetry.state_of_charge ? 'border-white/20' : 'border-slate-800'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between space-y-6 w-full">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border font-mono tracking-wider ${socTheme.badge}`}>
                    {currentStatusText}
                  </span>
                  {telemetry.alarms !== 'NONE' && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20 animate-pulse flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> ALARM TRIGGERED
                    </span>
                  )}
                </div>

                <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">STATE OF CHARGE (SOC)</h2>

                <div className="flex items-baseline space-x-1">
                  <span className={`text-8xl font-black font-mono tracking-tighter transition-all duration-500 ${socTheme.text}`}>
                    {telemetry.state_of_charge}
                  </span>
                  <span className="text-3xl font-bold text-slate-400 font-mono">%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-900">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider block">POWER FLOW</span>
                  <span className={`text-lg font-bold font-mono block ${isCharging ? 'text-emerald-400' : isDischarging ? 'text-rose-500' : 'text-slate-400'}`}>
                    {fmtPower(telemetry.power_watts)} <span className="text-xs font-normal text-slate-500">W</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider block">PACK CURRENT</span>
                  <span className={`text-lg font-bold font-mono block ${isCharging ? 'text-emerald-400' : isDischarging ? 'text-rose-500' : 'text-slate-400'}`}>
                    {fmtAmp(telemetry.current_amps)} <span className="text-xs font-normal text-slate-500">A</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider block">PACK VOLTAGE</span>
                  <span className="text-lg font-bold font-mono text-slate-100 block">
                    {fmtVolt(telemetry.total_voltage)} <span className="text-xs font-normal text-slate-500">V</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider block">REMAINING ENERGY</span>
                  <span className="text-lg font-bold font-mono text-slate-100 block">
                    {telemetry.remaining_capacity.toFixed(1)} <span className="text-xs font-normal text-slate-500">Ah</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400">
                <div className="flex items-center space-x-2 bg-[#0e1628] border border-slate-800 px-3.5 py-2 rounded-xl">
                  <Sun className={`w-4 h-4 ${telemetry.charge_mode === 'DAY' ? 'text-amber-400' : 'text-slate-600'}`} />
                  <span>MODE: <strong className="text-slate-200">{telemetry.charge_mode}</strong></span>
                </div>

                <div className="flex items-center space-x-2 bg-[#0e1628] border border-slate-800 px-3.5 py-2 rounded-xl">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>RELAY: <strong className={telemetry.relay_status === 'ON' ? 'text-emerald-400' : 'text-rose-400'}>{telemetry.relay_status}</strong></span>
                </div>

                <div className="flex items-center space-x-2 bg-[#0e1628] border border-slate-800 px-3.5 py-2 rounded-xl">
                  <Cpu className="w-4 h-4 text-teal-400" />
                  <span>CYCLE COUNT: <strong className="text-slate-200">{telemetry.cycle_count}</strong></span>
                </div>

                <div className="flex items-center space-x-2 bg-[#0e1628] border border-slate-800 px-3.5 py-2 rounded-xl">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>UPTIME: <strong className="text-slate-200">{telemetry.uptime.toFixed(1)}h</strong></span>
                </div>
              </div>

            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <section className="bg-[#0d1424]/85 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-800/60">
                <h3 className="font-bold tracking-wider text-sm text-cyan-400 uppercase flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-cyan-400" /> TEMPERATURES & HARDWARE
                </h3>
                <span className="text-[10px] font-mono text-slate-500">GROUP_01</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/50 border border-slate-900/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-teal-400" /> MOSFET Temperature
                    </span>
                    <span className={`font-semibold font-mono ${telemetry.mos_temperature > 65 ? 'text-rose-400' : 'text-teal-400'}`}>
                      {telemetry.mos_temperature.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        telemetry.mos_temperature > 65
                          ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                          : telemetry.mos_temperature > 50
                          ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                          : 'bg-gradient-to-r from-cyan-500 to-teal-400'
                      }`}
                      style={{ width: `${Math.min((telemetry.mos_temperature / 90) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/50 border border-slate-900/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-cyan-400" /> Battery Cell Temp T1
                    </span>
                    <span className="font-semibold font-mono text-cyan-400">
                      {telemetry.battery_temperature_1.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((telemetry.battery_temperature_1 / 60) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/50 border border-slate-900/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-blue-400" /> Battery Cell Temp T2
                    </span>
                    <span className="font-semibold font-mono text-blue-400">
                      {telemetry.battery_temperature_2.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((telemetry.battery_temperature_2 / 60) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950/65 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider">CHARGE MOS</span>
                  <div className="flex items-center space-x-1">
                    {telemetry.chg_mos === 'ON' ? (
                      <>
                        <ToggleRight className="w-6 h-6 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 font-mono">ACTIVE</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-6 h-6 text-slate-600" />
                        <span className="text-xs font-bold text-slate-500 font-mono">OFF</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/65 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wider">DISCHARGE MOS</span>
                  <div className="flex items-center space-x-1">
                    {telemetry.dsg_mos === 'ON' ? (
                      <>
                        <ToggleRight className="w-6 h-6 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 font-mono">ACTIVE</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-6 h-6 text-slate-600" />
                        <span className="text-xs font-bold text-slate-500 font-mono">OFF</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs flex items-center space-x-3 transition-colors ${
              telemetry.alarms === 'NONE'
                ? 'bg-emerald-500/5 text-emerald-400/90 border-emerald-500/10'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
            }`}>
              <div className={`p-1.5 rounded-lg ${telemetry.alarms === 'NONE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {telemetry.alarms === 'NONE' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <span className="block text-[10px] text-slate-500 font-semibold tracking-wider uppercase">SAFETY DIAGNOSTICS</span>
                <span className="font-semibold block truncate font-mono">
                  {telemetry.alarms === 'NONE' ? 'ALL SYSTEMS NORMAL' : telemetry.alarms.toUpperCase().replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-[#0d1424]/85 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-800/60">
                <h3 className="font-bold tracking-wider text-sm text-cyan-400 uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" /> ELECTRICAL TELEMETRY
                </h3>
                <span className="text-[10px] font-mono text-slate-500">GROUP_02</span>
              </div>

              <div className="space-y-3.5">
                <span className="text-[10px] font-semibold text-slate-500 tracking-wider block uppercase mb-1">INDIVIDUAL CELL MONITOR</span>

                {[
                  { id: 1, val: telemetry.cell_1_voltage },
                  { id: 2, val: telemetry.cell_2_voltage },
                  { id: 3, val: telemetry.cell_3_voltage },
                  { id: 4, val: telemetry.cell_4_voltage },
                ].map(cell => {
                  const minPossibleV = 2.6;
                  const maxPossibleV = 3.65;
                  const cellPercent = Math.min(Math.max(((cell.val - minPossibleV) / (maxPossibleV - minPossibleV)) * 100, 5), 100);

                  const isMax = cell.val === telemetry.cell_max;
                  const isMin = cell.val === telemetry.cell_min;

                  return (
                    <div key={cell.id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-bold font-mono flex items-center justify-center text-slate-400">
                            C{cell.id}
                          </span>
                          <span className="text-slate-400 text-xs">Cell {cell.id} Voltage</span>
                          {isMax && <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20 font-semibold font-mono">MAX</span>}
                          {isMin && <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded border border-amber-500/20 font-semibold font-mono">MIN</span>}
                        </div>
                        <span className="font-mono font-bold text-slate-200">
                          {fmtVolt(cell.val)} <span className="text-slate-500 text-[10px] font-normal">V</span>
                        </span>
                      </div>

                      <div className="h-2 bg-slate-950/80 rounded-full border border-slate-900/60 p-0.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            isMin
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              : isMax
                              ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                              : 'bg-gradient-to-r from-teal-500 to-teal-400'
                          }`}
                          style={{ width: `${cellPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-900">
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-900/60">
                <span className="text-[10px] font-semibold text-slate-500 tracking-wider block">REMAIN CAPACITY</span>
                <span className="font-mono font-bold text-slate-300 text-sm">
                  {telemetry.remaining_capacity.toFixed(2)} <span className="text-xs font-normal text-slate-500">Ah</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-900/60">
                <span className="text-[10px] font-semibold text-slate-500 tracking-wider block">SYSTEM ENERGY</span>
                <span className="font-mono font-bold text-slate-300 text-sm">
                  {((telemetry.remaining_capacity * telemetry.total_voltage) / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">kWh</span>
                </span>
              </div>
            </div>
          </section>

          <section className="bg-[#0d1424]/85 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-800/60">
                <h3 className="font-bold tracking-wider text-sm text-cyan-400 uppercase flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" /> SYSTEM ANALYTICS
                </h3>
                <span className="text-[10px] font-mono text-slate-500">GROUP_03</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-900">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Max Cell Voltage
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {fmtVolt(telemetry.cell_max)} V
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-900">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Min Cell Voltage
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {fmtVolt(telemetry.cell_min)} V
                  </span>
                </div>

                <div className={`flex justify-between items-center py-2 px-3 rounded-xl border transition-colors ${
                  telemetry.cell_delta > 0.05
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 animate-pulse'
                    : telemetry.cell_delta > 0.02
                    ? 'bg-amber-500/5 border-amber-500/15 text-amber-300'
                    : 'bg-slate-950/40 border-slate-900 text-slate-200'
                }`}>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className={`w-3.5 h-3.5 ${
                      telemetry.cell_delta > 0.05 ? 'text-rose-400' : telemetry.cell_delta > 0.02 ? 'text-amber-400' : 'text-slate-500'
                    }`} />
                    Cell Voltage Delta
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {(telemetry.cell_delta * 1000).toFixed(0)} <span className="text-[10px] font-normal text-slate-500">mV</span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-900">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span> Average Cell Voltage
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {telemetry.cell_avg.toFixed(4)} V
                  </span>
                </div>

              </div>
            </div>

            <div className={`p-4 rounded-xl border ${
              telemetry.bal_status === 'ACTIVE'
                ? 'bg-amber-500/10 border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                : 'bg-slate-950/65 border-slate-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-3 h-3 rounded-full relative flex ${
                    telemetry.bal_status === 'ACTIVE' ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'
                  }`}>
                    {telemetry.bal_status === 'ACTIVE' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 block tracking-widest uppercase">CELL BALANCER</span>
                    <span className={`font-mono text-xs font-bold ${telemetry.bal_status === 'ACTIVE' ? 'text-amber-400' : 'text-slate-400'}`}>
                      {telemetry.bal_status === 'ACTIVE' ? 'BALANCING ACTIVE' : 'BALANCING IDLE'}
                    </span>
                  </div>
                </div>

                {telemetry.bal_status === 'ACTIVE' && (
                  <div className="text-right">
                    <span className="text-[9px] font-semibold text-slate-500 block uppercase">BYPASS CURR.</span>
                    <span className="font-mono text-xs font-extrabold text-amber-400">
                      {telemetry.bal_current.toFixed(3)} A
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>

        <footer className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-center sm:text-left gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-600" />
            <span>Industrial SCADA Node telemetry streamed via MQTT over WebSockets.</span>
          </div>
          <span className="text-[10px] text-slate-600 font-mono">
            NODE_ADDR: <strong className="text-slate-500">0x3F_BMS_LITE_4S</strong>
          </span>
        </footer>

      </div>
    </div>
  );
}