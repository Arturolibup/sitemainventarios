<?php

namespace App\Http\Controllers\Product;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class EntryEvidenceController extends Controller
{
   public function __construct()
{
  $this->middleware('auth:api');
  $this->middleware('permission:products.view')->only(['show']);
}
}
