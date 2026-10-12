import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({erro:'Envio indisponivel.'},{status:503});}
