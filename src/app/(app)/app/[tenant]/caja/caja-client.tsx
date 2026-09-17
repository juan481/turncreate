"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";

export function CajaClient() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialBalance, setInitialBalance] = useState("");
  const [currentBalance, setCurrentBalance] = useState(0);

  const handleOpenCaja = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(initialBalance) || 0;
    setCurrentBalance(balance);
    setIsOpen(true);
  };

  const handleCloseCaja = () => {
    if (confirm("¿Estás seguro de que quieres cerrar la caja?")) {
      setIsOpen(false);
      setInitialBalance("");
      setCurrentBalance(0);
    }
  };

  if (!isOpen) {
    return (
      <Card className="max-w-[28rem] mx-auto p-lg mt-xl space-y-md">
        <div className="flex justify-between items-center">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Estado de Caja</h2>
          <StatusPill status="alert">Cerrada</StatusPill>
        </div>
        
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          La caja está cerrada. Debes abrirla para comenzar a registrar transacciones.
        </p>

        <form onSubmit={handleOpenCaja} className="space-y-md">
          <div className="space-y-xs">
            <label htmlFor="initialBalance" className="font-label-sm text-label-sm text-on-surface">
              Saldo Inicial
            </label>
            <Input 
              id="initialBalance"
              type="number" 
              placeholder="0.00" 
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              required
              min="0"
              step="0.01"
            />
          </div>
          <Button type="submit" className="w-full">Abrir Caja</Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Caja Actual</h1>
          <div className="mt-xs">
            <StatusPill status="confirmed">Abierta</StatusPill>
          </div>
        </div>
        <Button variant="secondary" onClick={handleCloseCaja}>
          Cerrar Caja (Arqueo)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Card className="p-lg flex flex-col gap-xs bg-primary/5">
          <p className="font-label-md text-label-md text-on-surface-variant">Saldo Actual en Caja</p>
          <p className="font-headline-lg-mobile text-headline-lg-mobile text-primary">
            ${currentBalance.toFixed(2)}
          </p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-md border-b border-border bg-surface-muted">
          <h3 className="font-title-md text-title-md text-on-surface">Transacciones del Día</h3>
        </div>
        <div className="divide-y divide-border">
          {/* Static Mock Data for now */}
          <div className="p-md flex justify-between items-center hover:bg-surface-muted transition-colors">
            <div>
              <p className="font-label-md text-label-md text-on-surface">Corte de pelo - Juan Pérez</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Efectivo • 10:30 AM</p>
            </div>
            <p className="font-label-md text-label-md text-status-confirmed">+$15.00</p>
          </div>
          <div className="p-md flex justify-between items-center hover:bg-surface-muted transition-colors">
            <div>
              <p className="font-label-md text-label-md text-on-surface">Barba - Carlos Gómez</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Tarjeta • 11:15 AM</p>
            </div>
            <p className="font-label-md text-label-md text-status-confirmed">+$10.00</p>
          </div>
          <div className="p-md flex justify-between items-center hover:bg-surface-muted transition-colors">
            <div>
              <p className="font-label-md text-label-md text-on-surface">Compra insumos (Café)</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Efectivo • 12:00 PM</p>
            </div>
            <p className="font-label-md text-label-md text-status-alert">-$5.00</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
